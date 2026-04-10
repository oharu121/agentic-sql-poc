# agent/sql_agent.py
import re
from functools import lru_cache
from pathlib import Path

import ollama
import duckdb
import pandas as pd

from sql.queries import QUERIES
from sql.schema import (
    AREA_PL_COLUMNS,
    AREA_PL_TABLE,
    AREA_VALUES,
    PRODUCT_CATEGORY_VALUES,
    PRODUCT_SALES_COLUMNS,
    PRODUCT_SALES_TABLE,
    QUARTER_VALUES,
    YEAR_VALUES,
)

# Questions from QUERIES to include as few-shot examples in the system prompt.
_FEW_SHOT_KEYS = [
    "全エリアで2025年度の計画比達成率が最も低いのはどこか？",
    "2025年度Q2の商品別売上ランキングを教えてください。",
]

MODEL = "gemma4:e4b"  # update if your Ollama tag differs (check: ollama list)
MAX_RETRIES = 2  # total attempts = 1 + MAX_RETRIES


def _build_few_shot_section() -> str:
    """Format selected reference queries as compact Q/A examples."""
    lines = []
    for key in _FEW_SHOT_KEYS:
        sql = " ".join(QUERIES[key].split())  # collapse to single line
        lines.append(f"Q: {key}\nA: {sql}")
    return "\n\n".join(lines)


@lru_cache(maxsize=1)
def build_system_prompt() -> str:
    def fmt_cols(columns: dict[str, str]) -> str:
        return "\n".join(
            f'  - "{col}" ({dtype})' for col, dtype in columns.items()
        )

    return f"""You are a SQL expert for a Japanese housing company financial reporting system.

When asked a question in Japanese, generate a single DuckDB SQL query to answer it.
Return ONLY the SQL query — no explanation, no markdown fences, no commentary.
Only generate SELECT statements. Never generate DDL or DML (no DROP, INSERT, UPDATE, DELETE).

IMPORTANT: All Japanese column names MUST be wrapped in double quotes (e.g., "エリア", "売上_実績").

---

Table: {AREA_PL_TABLE}
Columns:
{fmt_cols(AREA_PL_COLUMNS)}
Valid values:
  - "エリア": {AREA_VALUES}
  - "四半期": {QUARTER_VALUES}
  - "年度": {YEAR_VALUES}

Table: {PRODUCT_SALES_TABLE}
Columns:
{fmt_cols(PRODUCT_SALES_COLUMNS)}
Valid values:
  - "商品カテゴリ": {PRODUCT_CATEGORY_VALUES}
  - "エリア": {AREA_VALUES}
  - "四半期": {QUARTER_VALUES}
  - "年度": {YEAR_VALUES}

---
Units: All monetary values (売上, 利益, 受注) are in 百万円 (million yen).
"今期" means 2025年度 unless context suggests otherwise.

IMPORTANT: Each table has one row per (エリア, 四半期) combination.
When comparing across areas or categories, always use SUM() to aggregate over quarters.

---
Examples:

{_build_few_shot_section()}"""


def load_database(processed_dir: Path) -> duckdb.DuckDBPyConnection:
    """Load both Parquet files into an in-memory DuckDB instance."""
    area_parquet = processed_dir / f"{AREA_PL_TABLE}.parquet"
    product_parquet = processed_dir / f"{PRODUCT_SALES_TABLE}.parquet"
    for f in [area_parquet, product_parquet]:
        if not f.exists():
            raise FileNotFoundError(
                f"Parquet file not found: {f}\n"
                "Run 'uv run python etl/excel_to_parquet.py' to generate it."
            )
    con = duckdb.connect()
    con.execute(
        f"CREATE TABLE {AREA_PL_TABLE} AS "
        f"SELECT * FROM read_parquet('{area_parquet}')"
    )
    con.execute(
        f"CREATE TABLE {PRODUCT_SALES_TABLE} AS "
        f"SELECT * FROM read_parquet('{product_parquet}')"
    )
    return con


def _extract_sql(raw: str) -> str:
    """Strip markdown fences and whitespace from LLM output."""
    sql = raw.strip()
    fence_match = re.search(r"```(?:sql)?\s*\n(.*?)```", sql, re.DOTALL | re.IGNORECASE)
    if fence_match:
        sql = fence_match.group(1).strip()
    return sql


def ask(question: str, con: duckdb.DuckDBPyConnection) -> dict:
    """
    Send a natural language question to the local Ollama model, execute the
    returned SQL against DuckDB, and return question + sql + result DataFrame.
    Retries up to MAX_RETRIES times on SQL execution errors, feeding the error
    back to the LLM for self-correction.
    """
    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": question},
    ]

    last_sql = ""
    last_error: Exception | None = None

    for attempt in range(1 + MAX_RETRIES):
        response = ollama.chat(model=MODEL, messages=messages)
        sql = _extract_sql(response.message.content or "")

        if not sql.upper().startswith("SELECT"):
            raise RuntimeError(
                f"Agent returned non-SELECT SQL (rejected for safety):\n{sql}"
            )

        try:
            result: pd.DataFrame = con.execute(sql).df()
            if attempt > 0:
                print(f"  (self-corrected on attempt {attempt + 1})")
            return {"question": question, "sql": sql, "result": result}
        except duckdb.Error as exc:
            last_sql = sql
            last_error = exc
            if attempt < MAX_RETRIES:
                messages.append({"role": "assistant", "content": sql})
                messages.append({
                    "role": "user",
                    "content": (
                        f"That SQL failed with error: {exc}\n"
                        "Please fix the query and return only the corrected SQL."
                    ),
                })

    raise RuntimeError(
        f"SQL execution failed after {1 + MAX_RETRIES} attempts.\n"
        f"Last SQL:\n{last_sql}\nError: {last_error}"
    )
