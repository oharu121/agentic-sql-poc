# Plan: Agentic SQL POC: local Text-to-SQL pipeline

**Status:** Completed
**Date:** 2026-04-08

## Context

The production system will route Excel uploads through Lambda ETL to S3 (Parquet), queried by Athena via a Claude-powered Text-to-SQL agent. Before committing to the full AWS build, we needed to validate that Text-to-SQL actually works well for highly structured Japanese financial data — specifically whether an LLM can reliably generate correct SQL with Japanese column names, plan-vs-actual comparisons, and grouped aggregations.

The local POC replaces the AWS stack with DuckDB (reads Parquet natively, same SQL dialect as Athena) and Ollama/Gemma 4 (local LLM, zero API cost). If the SQL logic works here, it transfers to production without modification.

## Approach

A single Python file (`sql/schema.py`) serves as the single source of truth for all table and column definitions. Every other component — ETL validation, DuckDB table registration, and the LLM system prompt — imports from it. This eliminates the most common failure mode in Text-to-SQL systems: schema drift between the database and the prompt.

The ETL validates incoming Excel files against the schema before writing Parquet, catching column mismatches or type errors at ingestion time rather than at query time. The agent builds its system prompt dynamically from the schema, including categorical values (area names, product categories, quarter labels) so the LLM can generate correct WHERE clauses without guessing.

DuckDB was chosen over SQLite because it reads Parquet natively and supports the same SQL dialect as Athena (Presto/Trino), making the agent's SQL transferable to production.

## Changes

### 1. Project scaffold and dependencies

Set up a uv-managed Python project with pandas, openpyxl, pyarrow, duckdb, ollama, and pytest. Hatchling build system with explicit package discovery for the multi-package layout.

### 2. Schema definitions (`sql/schema.py`)

Defined two tables — `area_pl` (9 columns: area, year, quarter, plan/actual for revenue, profit, orders) and `product_sales` (6 columns: product category, area, year, quarter, plan/actual revenue). All column names are Japanese. Enumerated categorical values for use in the system prompt.

### 3. Dummy data generator (`scripts/generate_dummy_data.py`)

Generates 40 rows of area P&L and 120 rows of product sales as Excel files. Uses a fixed random seed for reproducibility. Plan-vs-actual varies by -15% to +10%, with four specific area/quarter combinations deliberately underperforming to create realistic demo results.

### 4. ETL with validation (`etl/excel_to_parquet.py`)

Reads Excel, validates required columns exist, validates INTEGER columns are numeric, casts to int64, and writes Parquet. Raises clear errors with column names on validation failure. Does not write any output file if validation fails. The `run_etl()` function orchestrates both files.

### 5. Reference SQL queries (`sql/queries.py`)

Three hand-written queries answering: cumulative 2025 revenue for Kanto area, area with lowest plan achievement rate, and Q2 2025 product sales ranking. These serve as ground truth for evaluating agent-generated SQL.

### 6. Text-to-SQL agent (`agent/sql_agent.py`)

Builds a schema-aware system prompt (cached with lru_cache), sends the user's Japanese question to Ollama/Gemma 4, extracts SQL from the response (with regex-based markdown fence stripping), validates it's a SELECT statement, and executes against DuckDB. Returns question, SQL, and result DataFrame.

### 7. Demo runner (`test_queries.py`)

Runs the three demo questions end-to-end and prints Q → Generated SQL → Result. Auto-runs ETL if Parquet files don't exist.

## Files Modified

| File | Change |
|------|--------|
| [pyproject.toml](pyproject.toml) | Project config with all dependencies, pytest testpaths |
| [sql/schema.py](sql/schema.py) | Single source of truth for table/column definitions |
| [sql/queries.py](sql/queries.py) | Three reference SQL queries |
| [scripts/generate_dummy_data.py](scripts/generate_dummy_data.py) | Dummy Excel data generator |
| [etl/excel_to_parquet.py](etl/excel_to_parquet.py) | ETL with column/type validation |
| [agent/sql_agent.py](agent/sql_agent.py) | Text-to-SQL agent using Ollama |
| [test_queries.py](test_queries.py) | Demo runner |
| [tests/test_etl.py](tests/test_etl.py) | 8 ETL tests |
| [tests/test_agent.py](tests/test_agent.py) | 11 agent tests |
| [README.md](README.md) | Project documentation |
| [.gitignore](.gitignore) | Ignores .venv, pycache, processed parquet |

## Guard Rails

| Scenario | Behavior |
|----------|----------|
| Excel file missing a required column | ETL raises `ValueError` naming the missing columns; no Parquet written |
| Non-numeric value in an INTEGER column | ETL raises `TypeError` naming the column and its actual dtype |
| LLM generates DDL/DML (DROP, INSERT, etc.) | Runtime guard rejects non-SELECT SQL before execution |
| LLM wraps SQL in markdown fences | Regex extracts the SQL block regardless of position |
| LLM generates syntactically invalid SQL | `RuntimeError` raised with the generated SQL and DuckDB error for debugging |
| Parquet files missing when running demo | `test_queries.py` auto-runs ETL; `load_database()` raises `FileNotFoundError` with fix instructions |

## Verification

```bash
# 1. Install and generate
uv sync --dev
uv run python scripts/generate_dummy_data.py
uv run python etl/excel_to_parquet.py

# 2. Run unit tests (no Ollama needed — mocked)
uv run pytest tests/ -v
# Expected: 19 passed

# 3. Run demo (requires Ollama with gemma4)
uv run python test_queries.py
# Expected: 3 questions answered with visible SQL and results
```

## Breaking Changes

None — this is the initial release.
