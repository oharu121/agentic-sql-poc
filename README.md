# Agentic SQL POC — Japanese Financial Data

Text-to-SQL agent over structured Japanese financial data, with a full-stack educational UI that makes every pipeline step visible. Validates the approach before building on AWS (Lambda → S3 → Athena).

## Architecture

```
Excel (dummy data)
      │
      ▼
ETL (pandas + validation)          ← validates columns against schema.py
      │
      ▼
Parquet (data/processed/)
      │
      ▼
DuckDB (in-memory)                 ← local stand-in for AWS Athena
      │
      ▼
Gemini / Ollama (Text-to-SQL)     ← SSE-streamed pipeline with self-correction retries
      │
      ▼
SQL → result DataFrame → UI
```

**AWS production equivalent:** Excel upload → Lambda ETL → S3 (Parquet) → Athena → Text-to-SQL agent. DuckDB uses identical SQL syntax to Athena (Presto/Trino), so the agent logic transfers unchanged.

## Monorepo Structure

```
├── backend/           FastAPI + SSE backend (deployed to HuggingFace Spaces)
│   ├── app/           FastAPI application (routers, agents, config)
│   ├── agent/         NL → LLM → SQL → DuckDB agent (original CLI version)
│   ├── etl/           Excel → Parquet ETL with column validation
│   ├── sql/           Schema constants and reference queries
│   ├── data/          Raw Excel files and processed Parquet output
│   ├── tests/         36 unit tests (ETL + agent + API)
│   └── Dockerfile     HuggingFace Spaces Docker deployment
└── frontend/          Next.js 16 + Tailwind 4 + Zustand (deployed to Vercel)
    ├── app/           Pages and components (ThinkingPanel, SQLResultTable, ETLPipelineView…)
    ├── hooks/         useQuery — SSE event handler
    ├── stores/        Zustand query store with sessionStorage persistence
    └── lib/           API client, type definitions, constants
```

## Data

Two simulated Excel files for a Japanese housing company:

| File | Table | Description |
|---|---|---|
| `backend/data/raw/エリア収支.xlsx` | `area_pl` | Area P&L — 5 areas × 2 years × 4 quarters (40 rows) |
| `backend/data/raw/商品別売上.xlsx` | `product_sales` | Product sales — 3 categories × 5 areas × 2 years × 4 quarters (120 rows) |

Data is synthetic (generated with a fixed seed). Plan vs. actual differs by ±5–15%, with several quarters deliberately underperforming for realistic demo results.

## Local Development

**Prerequisites:** Python 3.11+, [uv](https://docs.astral.sh/uv/), Node 20+, [pnpm](https://pnpm.io), [Ollama](https://ollama.com) (optional, for local LLM)

```bash
# Install all dependencies
pnpm install          # root + frontend
cd backend && uv sync # backend Python deps

# Start both servers (from repo root)
pnpm dev
# → Next.js on http://localhost:3000
# → FastAPI on http://localhost:7860
```

Set `LLM_BACKEND=ollama` in `backend/.env` to use Ollama instead of Gemini.

## CLI Demo (backend only)

```bash
cd backend

# Generate Parquet files from Excel
uv run python etl/excel_to_parquet.py

# Run the demo: 3 Japanese NL questions → generated SQL → results
uv run python test_queries.py
```

## Running Tests

```bash
pnpm test              # frontend + backend
pnpm test:backend      # backend only (36 tests, no live LLM required)
pnpm test:frontend     # frontend only
```

## Key Design Decisions

**`sql/schema.py` as single source of truth.** Column names and table names are defined once and imported by the ETL validator, the DuckDB loader, and the LLM system prompt. Adding a column means editing one file.

**ETL validates before writing.** If required columns are missing or types are wrong, the ETL raises a clear error and writes no output. This simulates the fragility of real Excel uploads and makes the validation value visible.

**DuckDB as Athena proxy.** DuckDB reads Parquet natively with the same SQL dialect. The Text-to-SQL logic is identical to what will run against Athena — only the connection changes.

**SSE for pipeline visibility.** The backend emits a Server-Sent Event at every agent step (`prompt_build` → `llm_call` → `sql_extract` → `sql_execute` → `sql_retry` → `sql_done`). The frontend renders these as a live timeline so the pipeline is never a black box.

**DuckDB is application-scoped.** Loaded once in FastAPI `lifespan()` as `app.state.con` and reused across requests — reloading Parquet on every query would be wasteful.

## Deployment

| Service | Platform | Trigger |
|---------|----------|---------|
| Backend | HuggingFace Spaces (Docker) | push to `main` with changes in `backend/` |
| Frontend | Vercel | push to `main` with changes in `frontend/` |

Required secrets: `GEMINI_API_KEY`, `HF_TOKEN`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`.

## Regenerating Dummy Data

```bash
cd backend
uv run python scripts/generate_dummy_data.py
uv run python etl/excel_to_parquet.py
```
