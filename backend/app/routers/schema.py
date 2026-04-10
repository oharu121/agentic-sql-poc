"""Schema router — GET /api/schema returns table metadata and sample rows."""

import logging

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["schema"])

from sql.schema import (
    AREA_PL_TABLE,
    AREA_PL_COLUMNS,
    AREA_VALUES,
    QUARTER_VALUES,
    YEAR_VALUES,
    PRODUCT_SALES_TABLE,
    PRODUCT_SALES_COLUMNS,
    PRODUCT_CATEGORY_VALUES,
)

_ENUM_VALUES = {
    AREA_PL_TABLE: {
        "エリア": AREA_VALUES,
        "四半期": QUARTER_VALUES,
        "年度": YEAR_VALUES,
    },
    PRODUCT_SALES_TABLE: {
        "商品カテゴリ": PRODUCT_CATEGORY_VALUES,
        "エリア": AREA_VALUES,
        "四半期": QUARTER_VALUES,
        "年度": YEAR_VALUES,
    },
}


def _sample_rows(con, table: str, n: int = 3) -> list[list]:
    try:
        df = con.execute(f'SELECT * FROM "{table}" LIMIT {n}').df()
        rows = df.values.tolist()
        return [[v.item() if hasattr(v, "item") else v for v in row] for row in rows]
    except Exception:
        return []


@router.get("/schema")
async def get_schema(request: Request):
    """Return table schemas, column types, enum values, and sample rows."""
    con = request.app.state.con

    tables = []
    for table_name, columns in [
        (AREA_PL_TABLE, AREA_PL_COLUMNS),
        (PRODUCT_SALES_TABLE, PRODUCT_SALES_COLUMNS),
    ]:
        tables.append({
            "name": table_name,
            "columns": [{"name": col, "type": dtype} for col, dtype in columns.items()],
            "enum_values": _ENUM_VALUES.get(table_name, {}),
            "sample_rows": _sample_rows(con, table_name),
        })

    return {"tables": tables}
