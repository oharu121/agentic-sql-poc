# Plan: Add full-stack educational UI with live pipeline visualization

**Status:** Completed
**Date:** 2026-04-10

## Context

The project started as a CLI-only proof-of-concept: run a Python script, watch SQL appear in
the terminal, confirm the text-to-SQL pipeline works. That was enough to validate the core idea
— but it made the pipeline invisible. A reader looking at the repo couldn't see which steps the
agent takes, what the schema looks like, or how the ETL converts Excel to DuckDB-queryable
Parquet. The demo value was almost entirely in the code, not the experience.

The goal of this release is to make every part of the pipeline visible and interactive: users
can trigger the ETL themselves, watch it execute stage by stage, browse the resulting schema,
then ask natural language questions and see the agent's thinking process unfold in real time —
prompt construction, LLM call, SQL extraction, execution, and self-correction retries.

## Approach

The architecture follows the same SSE streaming pattern established in a reference project
(`rich-chat-demo`): a FastAPI backend emits Server-Sent Events at each pipeline step, and a
Next.js frontend consumes them to update a live UI. The key difference from a chat UI is that
SQL generation must be non-streaming — the full SQL needs to come back before it can be
executed against DuckDB — so `generate_content` (non-streaming) is used with multi-turn
`contents` lists for the retry correction loop.

Rather than creating a separate repo, `backend/` and `frontend/` directories were added to the
existing monorepo. All Python packages (`agent/`, `etl/`, `sql/`, `scripts/`, `tests/`) were
moved into `backend/` via `git mv` so history is preserved and Docker deployment is
self-contained (no PYTHONPATH hacks needed). The existing CLI and tests were left intact.

Gemini (`gemini-2.0-flash`) is the production LLM. A `LLM_BACKEND=ollama` env var switches to
local Ollama for development without touching any other code.

DuckDB is loaded once in FastAPI `lifespan()` as `app.state.con` and reused across requests —
loading from Parquet on every request would be wasteful.

## Changes

### Backend (`backend/`)

- **`app/config.py`** — `Settings` dataclass reads `GEMINI_API_KEY`, `LLM_BACKEND`,
  `GEMINI_MODEL`, `OLLAMA_MODEL`, `RAW_DIR`, `PROCESSED_DIR` from env. Paths default relative
  to `backend/`.
- **`app/agents/llm.py`** — `call_llm(system_prompt, messages)` dispatcher: Gemini path uses
  `google-genai` SDK with `system_instruction` + `temperature=0` + `max_output_tokens=512`;
  Ollama path wraps `ollama.chat()` in `asyncio.to_thread()`. Maps `role: "assistant"` →
  `"model"` for Gemini's API.
- **`app/agents/sql_agent.py`** — `ask_streaming()` async generator yields 6 thinking steps:
  `prompt_build` → `llm_call` → `sql_extract` → `sql_execute` → `sql_retry` (0–2×) →
  `sql_done`. Uses `asyncio.to_thread()` for DuckDB queries. Converts numpy scalars to Python
  natives for JSON serialisation.
- **`app/routers/chat.py`** — `POST /api/query` streams `ask_streaming()` output as SSE via
  `StreamingResponse(text/event-stream)`.
- **`app/routers/schema.py`** — `GET /api/schema` returns table names, column names + types,
  enum values for VARCHAR columns, and 3 sample rows.
- **`app/routers/etl.py`** — `POST /api/etl/run` streams ETL sub-steps as SSE; after
  completion reloads `app.state.con`. `GET /api/etl/preview/{table}` returns the first 20 rows
  of a Parquet file.
- **`app/main.py`** — `lifespan()` auto-runs ETL if Parquet files are missing, loads DuckDB
  into `app.state.con`. Endpoints `GET /api/health` and `GET /healthz` for HF Spaces cold-start
  wake ping.
- **`Dockerfile`** — non-root user, `uv`, port 7860, health check. Ready for HuggingFace
  Spaces Docker deployment.

### Frontend (`frontend/`)

- **`lib/types.ts`** — full SSE event union type `SQLSSEEvent` plus `QueryRecord`,
  `ThinkingStep`, `TableSchema` interfaces.
- **`lib/api.ts`** — `streamSSE<T>()` generic SSE generator; `streamQuery()`, `streamETL()`,
  `fetchParquetPreview()`, `fetchSchema()`, `checkHealth()`.
- **`stores/queryStore.ts`** — Zustand store with sessionStorage persistence; granular actions
  (`appendThinkingStep`, `setGeneratedSQL`, `addRetry`, `setResult`, `setStatus`).
- **`hooks/useQuery.ts`** — processes all `SQLSSEEvent` types, updates the store, handles error
  and retry events.
- **`components/sql/ThinkingPanel.tsx`** — timeline of pipeline steps with icon, label, elapsed
  time, and collapsible detail per step.
- **`components/sql/SQLResultTable.tsx`** — SQL code block, retry history with yellow badges,
  result data table with sticky header, error state.
- **`components/QueryCard.tsx`** — user bubble + agent response card; wraps `ThinkingPanel` +
  `SQLResultTable`; collapsible when complete.
- **`components/QueryInterface.tsx`** — main chat area with auto-scroll, example questions, and
  clear button.
- **`components/schema/SchemaSidebar.tsx`** — accordion per table: column list with type
  badges, enum pills, expandable sample rows.
- **`components/etl/ETLPipelineView.tsx`** — animated stage cards (Excel → Validate → Parquet
  → DuckDB); calls `onComplete()` to refresh downstream components.
- **`components/etl/ParquetPreviewTable.tsx`** — tab selector for `area_pl` /
  `product_sales`; uses `useReducer` with discriminated union state to avoid cascading renders
  from synchronous `setState` in effects.

### Monorepo infrastructure

- Root **`package.json`** with `dev`, `typecheck`, `test`, `sync` scripts via `concurrently`.
- **`.github/workflows/deploy-frontend.yml`** — path-scoped to `frontend/**`; pnpm test →
  Vercel deploy on push to main.
- **`.github/workflows/deploy-backend.yml`** — path-scoped to `backend/**`; uv pyright +
  pytest → HuggingFace Spaces force-push on push to main.
- **`.github/workflows/dependabot-auto-merge.yml`** and **`.github/dependabot.yml`** — weekly
  npm (in `frontend/`) and GitHub Actions updates with auto-merge.
- **`README.md`** — HuggingFace Space YAML frontmatter prepended (`sdk: docker`,
  `app_port: 7860`).

## Files Modified

| File | Change |
|------|--------|
| [backend/](backend/) | All Python packages moved here from root via `git mv`; new FastAPI app added |
| [frontend/](frontend/) | New Next.js 16 + Tailwind 4 + Zustand frontend |
| [.github/workflows/deploy-frontend.yml](.github/workflows/deploy-frontend.yml) | New — frontend CI/CD to Vercel |
| [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml) | New — backend CI/CD to HuggingFace Spaces |
| [.github/workflows/dependabot-auto-merge.yml](.github/workflows/dependabot-auto-merge.yml) | New — Dependabot auto-merge |
| [.github/dependabot.yml](.github/dependabot.yml) | New — weekly npm + GitHub Actions updates |
| [package.json](package.json) | New — root monorepo workspace scripts |
| [README.md](README.md) | HuggingFace Space YAML frontmatter added |

## Guard Rails

| Scenario | Behavior |
|----------|----------|
| HuggingFace cold start (free tier sleeps after ~15 min) | `checkHealth()` fires on page load to wake the Space before the user's first query |
| Parquet files missing on backend startup | `lifespan()` auto-runs ETL; no manual step required |
| ETL re-run while DuckDB is in use | `app.state.con` is closed and replaced atomically after ETL completes |
| LLM returns non-SELECT SQL | `ask_streaming()` raises `RuntimeError` — same DML guard as the original `ask()` |
| All retry attempts exhausted | `sql_error` SSE event emitted; `SQLResultTable` shows red error state with collapsible final SQL |
| `GEMINI_API_KEY` not set in production | `settings.validate()` raises on startup — fails fast before accepting traffic |

## Verification

```bash
# 1. Backend — start locally
cd backend
LLM_BACKEND=ollama uv run uvicorn app.main:app --port 7860

# 2. Verify ETL and schema endpoints
curl http://localhost:7860/api/health
curl http://localhost:7860/api/schema | jq '.tables[].name'
# → "area_pl", "product_sales"

# 3. Verify SSE query stream
curl -N -X POST http://localhost:7860/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"関東の売上は？"}' \
  | grep "event:"
# → event: thinking_step, sql_generated, sql_result, done

# 4. Frontend — in separate terminal
cd frontend && pnpm dev
# Open http://localhost:3000
# Type a question → ThinkingPanel animates → SQLResultTable populates

# 5. ETL flow
# Click "Run ETL" → stage cards animate → Parquet preview refreshes → schema reloads

# 6. All checks
pnpm run typecheck   # 0 errors
pnpm run lint:frontend  # no issues
pnpm run test:backend   # 19 passed
```

## Breaking Changes

The root `pyproject.toml` is deleted. Any existing local workflow that ran `uv run` from the
repo root must now `cd backend` first. The CLI demo (`test_queries.py`) and all tests are
intact — they are now at `backend/test_queries.py` and `backend/tests/`.
