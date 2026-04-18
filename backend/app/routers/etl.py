"""ETL router — run Excel→Parquet pipeline with SSE progress, and preview Parquet data."""

import asyncio
import json
import logging
import time
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.config import settings
from etl.excel_to_parquet import validate_columns, validate_types
from sql.schema import (
    AREA_PL_COLUMNS,
    AREA_PL_TABLE,
    PRODUCT_SALES_COLUMNS,
    PRODUCT_SALES_TABLE,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/etl", tags=["etl"])

_ETL_FILES = [
    {
        "excel_name": "エリア収支.xlsx",
        "table": AREA_PL_TABLE,
        "columns": AREA_PL_COLUMNS,
    },
    {
        "excel_name": "商品別売上.xlsx",
        "table": PRODUCT_SALES_TABLE,
        "columns": PRODUCT_SALES_COLUMNS,
    },
]


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _etl_event(step: str, label: str, file: str, status: str, detail: str | None = None) -> str:
    payload: dict = {"step": step, "label": label, "file": file, "status": status}
    if detail is not None:
        payload["detail"] = detail
    return _sse("etl_step", payload)


async def _stream_etl(state):
    """Run ETL for both Excel files, emitting SSE events at each sub-step."""
    start = time.time()

    raw_dir = settings.RAW_DIR
    processed_dir = settings.PROCESSED_DIR

    for file_info in _ETL_FILES:
        excel_name = file_info["excel_name"]
        table = file_info["table"]
        columns = file_info["columns"]
        required_cols = list(columns.keys())

        excel_path = raw_dir / excel_name
        output_path = processed_dir / f"{table}.parquet"

        # Step: read Excel
        yield _etl_event("read", f"Reading {excel_name}…", excel_name, "running")
        try:
            df = await asyncio.to_thread(pd.read_excel, excel_path)
        except Exception as exc:
            yield _etl_event("read", f"Failed to read {excel_name}", excel_name, "error", detail=str(exc))
            yield _sse("done", {"processing_time_ms": int((time.time() - start) * 1000), "error": str(exc)})
            return
        yield _etl_event("read", f"Read {len(df)} rows from {excel_name}", excel_name, "done")

        # Step: validate columns
        yield _etl_event("validate_cols", "Validating columns…", excel_name, "running")
        try:
            await asyncio.to_thread(validate_columns, df, required_cols, excel_name)
        except ValueError as exc:
            yield _etl_event("validate_cols", "Column validation failed", excel_name, "error", detail=str(exc))
            yield _sse("done", {"processing_time_ms": int((time.time() - start) * 1000), "error": str(exc)})
            return
        yield _etl_event("validate_cols", "Columns validated", excel_name, "done")

        # Step: validate types
        yield _etl_event("validate_types", "Validating column types…", excel_name, "running")
        try:
            await asyncio.to_thread(validate_types, df, columns, excel_name)
        except TypeError as exc:
            yield _etl_event("validate_types", "Type validation failed", excel_name, "error", detail=str(exc))
            yield _sse("done", {"processing_time_ms": int((time.time() - start) * 1000), "error": str(exc)})
            return
        yield _etl_event("validate_types", "Types validated", excel_name, "done")

        # Step: write Parquet
        yield _etl_event("write_parquet", f"Writing {table}.parquet…", excel_name, "running")
        try:
            def _write():
                for col, dtype in columns.items():
                    if dtype == "INTEGER" and col in df.columns:
                        df[col] = df[col].astype("int64")
                output_path.parent.mkdir(parents=True, exist_ok=True)
                df[required_cols].to_parquet(output_path, index=False)

            await asyncio.to_thread(_write)
        except Exception as exc:
            yield _etl_event("write_parquet", "Parquet write failed", excel_name, "error", detail=str(exc))
            yield _sse("done", {"processing_time_ms": int((time.time() - start) * 1000), "error": str(exc)})
            return
        yield _etl_event("write_parquet", f"Wrote {output_path.name}", excel_name, "done")

    # Reload DuckDB with fresh Parquet data
    from agent.sql_agent import load_database
    try:
        state.con.close()
        state.con = load_database(processed_dir)
        logger.info("DuckDB reloaded after ETL")
    except Exception as exc:
        logger.warning(f"DuckDB reload failed: {exc}")

    yield _sse("done", {"processing_time_ms": int((time.time() - start) * 1000)})


@router.post("/run")
async def run_etl(request: Request):
    """SSE stream: run ETL pipeline for all Excel files."""
    return StreamingResponse(
        _stream_etl(request.app.state),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/preview/{table}")
async def preview_parquet(table: str):
    """Return first 20 rows of a Parquet file as JSON."""
    allowed = {AREA_PL_TABLE, PRODUCT_SALES_TABLE}
    if table not in allowed:
        raise HTTPException(status_code=404, detail=f"Unknown table: {table}")

    parquet_path = settings.PROCESSED_DIR / f"{table}.parquet"
    if not parquet_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Parquet file not found for table '{table}'. Run ETL first.",
        )

    df = await asyncio.to_thread(pd.read_parquet, parquet_path)
    df = df.head(20)
    columns = list(df.columns)
    rows = df.values.tolist()
    rows = [[v.item() if hasattr(v, "item") else v for v in row] for row in rows]
    return {"table": table, "columns": columns, "rows": rows}


# Mapping from table name to Excel filename for lookups
_TABLE_TO_EXCEL = {f["table"]: f["excel_name"] for f in _ETL_FILES}


@router.get("/excel-preview/{table}")
async def preview_excel(table: str):
    """Return first 20 rows of the source Excel file as JSON."""
    if table not in _TABLE_TO_EXCEL:
        raise HTTPException(status_code=404, detail=f"Unknown table: {table}")

    excel_name = _TABLE_TO_EXCEL[table]
    excel_path = settings.RAW_DIR / excel_name
    if not excel_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Excel file not found: {excel_name}",
        )

    df = await asyncio.to_thread(pd.read_excel, excel_path)
    df = df.head(20)
    columns = list(df.columns)
    rows = df.values.tolist()
    rows = [[v.item() if hasattr(v, "item") else v for v in row] for row in rows]
    return {"table": table, "source_file": excel_name, "columns": columns, "rows": rows}
