---
title: Agentic SQL POC
emoji: 🦆
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
short_description: Text-to-SQL agent with live pipeline visualization
license: mit
---

# Agentic SQL POC — Backend

FastAPI backend for the text-to-SQL educational UI. Streams every agent pipeline step as
Server-Sent Events so the frontend can visualize prompt construction, LLM calls, SQL
extraction, DuckDB execution, and self-correction retries in real time.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/query` | SSE stream — NL question → thinking steps → SQL → result |
| `GET` | `/api/schema` | Table schemas with column types, enum values, sample rows |
| `POST` | `/api/etl/run` | SSE stream — re-run Excel → Parquet ETL |
| `GET` | `/api/etl/preview/{table}` | First 20 rows of a Parquet table |
| `GET` | `/api/health` | Health check (wakes HF Space from cold start) |

## SSE Event Types

| Event | When |
|-------|------|
| `thinking_step` | Each agent pipeline stage (`prompt_build` → `llm_call` → `sql_extract` → `sql_execute` → `sql_retry` → `sql_done`) |
| `sql_generated` | SQL extracted from LLM response |
| `sql_result` | Query succeeded — includes columns, rows, row count |
| `sql_retry` | Self-correction attempt — includes error and corrected SQL |
| `sql_error` | All retries exhausted |
| `etl_step` | Each ETL sub-step during pipeline run |
| `done` | Stream complete |

## Local Development

```bash
# Install dependencies
uv sync

# Start server (Ollama backend, no API key needed)
LLM_BACKEND=ollama uv run uvicorn app.main:app --port 7860 --reload
```

Set `GEMINI_API_KEY` and omit `LLM_BACKEND` to use Gemini (production default).

## Running Tests

```bash
uv run pytest          # 19 tests, no live LLM required (ollama.chat is mocked)
uv run pyright         # type check
```
