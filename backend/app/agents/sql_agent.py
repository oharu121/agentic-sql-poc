"""Streaming SQL agent — mirrors agent/sql_agent.py but yields SSE events at each step.

The original agent/sql_agent.py is NOT modified; this module wraps the same pipeline
with event emission for the UI, running as an async generator.
"""

import asyncio
import logging
import re
import time
from collections.abc import AsyncIterator

import duckdb

from agent.sql_agent import build_system_prompt, _extract_sql
from app.agents.llm import call_llm

logger = logging.getLogger(__name__)

MAX_RETRIES = 2  # total attempts = 1 + MAX_RETRIES


def _step(step: str, label: str, status: str, detail: str | None = None, elapsed_ms: int | None = None) -> tuple[str, dict]:
    payload: dict = {"step": step, "label": label, "status": status}
    if detail is not None:
        payload["detail"] = detail
    if elapsed_ms is not None:
        payload["elapsed_ms"] = elapsed_ms
    return ("thinking_step", payload)


async def ask_streaming(
    question: str,
    con: duckdb.DuckDBPyConnection,
) -> AsyncIterator[tuple[str, dict]]:
    """
    Async generator that runs the text-to-SQL pipeline and yields SSE events.

    Yields tuples of (event_type, payload_dict):
      thinking_step  — pipeline stage progress
      sql_generated  — extracted SQL string
      sql_executing  — about to run DuckDB query
      sql_result     — successful query result
      sql_retry      — LLM self-correction attempt
      sql_error      — all retries exhausted
    """
    t0 = time.monotonic()

    # ── Step 1: Build system prompt ───────────────────────────────────────────
    yield _step("prompt_build", "Building system prompt…", "running")
    system_prompt = build_system_prompt()
    yield _step("prompt_build", "System prompt ready", "done", elapsed_ms=int((time.monotonic() - t0) * 1000))

    messages: list[dict] = [{"role": "user", "content": question}]
    last_sql = ""
    last_error: Exception | None = None

    for attempt in range(1 + MAX_RETRIES):
        # ── Step 2: Call LLM ──────────────────────────────────────────────────
        label = "Calling LLM…" if attempt == 0 else f"Retrying LLM (attempt {attempt + 1})…"
        yield _step("llm_call", label, "running")
        t_llm = time.monotonic()
        try:
            raw = await call_llm(system_prompt, messages)
        except Exception as exc:
            yield _step("llm_call", "LLM call failed", "error", detail=str(exc))
            yield ("sql_error", {"message": f"LLM error: {exc}", "final_sql": last_sql})
            return
        yield _step(
            "llm_call",
            "LLM responded",
            "done",
            detail=raw[:300] if raw else "(empty)",
            elapsed_ms=int((time.monotonic() - t_llm) * 1000),
        )

        # ── Step 3: Extract SQL ───────────────────────────────────────────────
        yield _step("sql_extract", "Extracting SQL from response…", "running")
        sql = _extract_sql(raw)

        if not sql.upper().startswith("SELECT"):
            yield _step("sql_extract", "Non-SELECT SQL rejected", "error", detail=sql)
            yield ("sql_error", {"message": "Model returned a non-SELECT statement (rejected for safety).", "final_sql": sql})
            return

        last_sql = sql
        yield ("sql_generated", {"sql": sql})
        yield _step("sql_extract", "SQL extracted", "done")

        # ── Step 4: Execute SQL ───────────────────────────────────────────────
        yield ("sql_executing", {"attempt": attempt + 1})
        yield _step("sql_execute", f"Executing SQL against DuckDB (attempt {attempt + 1})…", "running")
        t_exec = time.monotonic()

        try:
            result_df = await asyncio.to_thread(lambda: con.execute(sql).df())
        except duckdb.Error as exc:
            last_error = exc
            elapsed = int((time.monotonic() - t_exec) * 1000)
            yield _step("sql_execute", "SQL execution failed", "error", detail=str(exc), elapsed_ms=elapsed)

            if attempt < MAX_RETRIES:
                # Feed error back to LLM for self-correction
                messages.append({"role": "assistant", "content": sql})
                messages.append({
                    "role": "user",
                    "content": (
                        f"That SQL failed with error: {exc}\n"
                        "Please fix the query and return only the corrected SQL."
                    ),
                })
                yield ("sql_retry", {"attempt": attempt + 1, "error": str(exc), "corrected_sql": sql})
            continue

        # ── Success ───────────────────────────────────────────────────────────
        elapsed = int((time.monotonic() - t_exec) * 1000)
        yield _step("sql_execute", "Query executed successfully", "done", elapsed_ms=elapsed)

        columns = list(result_df.columns)
        rows = result_df.values.tolist()
        # Ensure JSON-serialisable: convert numpy scalars to Python natives
        rows = [[v.item() if hasattr(v, "item") else v for v in row] for row in rows]

        yield ("sql_result", {"columns": columns, "rows": rows, "row_count": len(rows)})
        yield _step("sql_done", "Pipeline complete", "done", elapsed_ms=int((time.monotonic() - t0) * 1000))
        return

    # All attempts exhausted
    yield ("sql_error", {
        "message": f"SQL execution failed after {1 + MAX_RETRIES} attempts. Last error: {last_error}",
        "final_sql": last_sql,
    })
