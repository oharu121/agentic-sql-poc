# agent/sql_agent.py
from pathlib import Path

import ollama
import duckdb
import pandas as pd

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

MODEL = "gemma4:e4b"  # update if your Ollama tag differs (check: ollama list)


def build_system_prompt() -> str:
    def fmt_cols(columns: dict[str, str]) -> str:
        return "\n".join(
            f'  - "{col}" ({dtype})' for col, dtype in columns.items()
        )

    return f"""You are a SQL expert for a Japanese housing company financial reporting system.

When asked a question in Japanese, generate a single DuckDB SQL query to answer it.
Return ONLY the SQL query — no explanation, no markdown fences, no commentary.

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
"""


def load_database(processed_dir: Path) -> duckdb.DuckDBPyConnection:
    """Load both Parquet files into an in-memory DuckDB instance."""
    con = duckdb.connect()
    con.execute(
        f"CREATE TABLE {AREA_PL_TABLE} AS "
        f"SELECT * FROM read_parquet('{processed_dir / 'area_pl.parquet'}')"
    )
    con.execute(
        f"CREATE TABLE {PRODUCT_SALES_TABLE} AS "
        f"SELECT * FROM read_parquet('{processed_dir / 'product_sales.parquet'}')"
    )
    return con


def ask(question: str, con: duckdb.DuckDBPyConnection) -> dict:
    """
    Send a natural language question to the local Ollama model, execute the
    returned SQL against DuckDB, and return question + sql + result DataFrame.
    """
    response = ollama.chat(
        model=MODEL,
        messages=[
            {"role": "system", "content": build_system_prompt()},
            {"role": "user", "content": question},
        ],
    )
    sql = response.message.content.strip()
    # Strip markdown code fences if the model wraps output despite instructions
    if sql.startswith("```"):
        sql = "\n".join(
            line for line in sql.splitlines()
            if not line.startswith("```")
        ).strip()
    result: pd.DataFrame = con.execute(sql).df()
    return {"question": question, "sql": sql, "result": result}
