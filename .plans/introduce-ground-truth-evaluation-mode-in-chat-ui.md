# Plan: Introduce ground-truth evaluation mode in chat UI

**Status:** Completed
**Date:** 2026-04-19

## Context

The chat interface accepts arbitrary Japanese business questions and renders the
agent's pipeline — thinking steps, generated SQL, and the resulting DuckDB row set.
What the demo could *not* answer was the obvious second question: is the agent
right? A reviewer watching a query stream by has no way to tell whether `2383` is
the correct cumulative sales total for 関東 in 2025, or whether the chosen エリア
in a "lowest achievement rate" query is actually the lowest. Free chat shows the
agent working; it does not show the agent being correct.

The reference repository at `c:/repositories/personal/rag-demo` solves the same
problem for a RAG pipeline with a JSON fixture of question/expected-answer pairs,
a backend evaluator, and a frontend that streams per-question pass/fail badges
into the chat plus an end-of-run accuracy summary. The goal of this change was
to bring that pattern into the SQL agent so a reviewer can press one button and
watch a fixed set of questions run through the real pipeline with objective
scoring.

## Approach

The reference repo scores RAG answers by checking that the free-form text
contains expected substrings. SQL gives us a stronger option: execute a
hand-written reference query and compare its DataFrame to the agent's. Both
approaches have failure modes — column aliases can diverge for matching answers,
and identical numeric values can appear in differently-shaped result sets — so
the evaluator runs both checks and a case passes if either succeeds. This keeps
the contract identical to the rag-demo fixture (`expected_answer_contains` /
`expected_answer_must_not_contain`) while letting result-equivalence catch the
common case for free.

For the UX, rather than introducing a separate test page, the chat header gained
a two-tab toggle (自由チャット / 精度テスト). Test mode reuses the same `QueryCard`
component the chat mode uses, so each scored question renders identically to a
real chat turn — thinking steps, generated SQL, and result table — with a small
scoring annotation appended below the result table. A summary bubble appears
once all queries finish. The streaming endpoint forwards every event the agent
already emits (`thinking_step`, `sql_generated`, `sql_result`, `done`) and adds
three new event types (`eval_query_start`, `eval_query_scored`, `eval_complete`)
so the existing client-side reducer logic stays unchanged.

## Changes

### Backend evaluator

A new package `app.data.evaluation` holds the scoring primitives separately from
the FastAPI surface so they remain unit-testable. `evaluator.results_equivalent`
sort-compares two DataFrames row-wise with `numpy.isclose` for numeric columns
and stringified equality for object columns, so the agent's choice of column
alias and ORDER BY is irrelevant. `evaluator.check_term_presence` mirrors the
rag-demo case-insensitive substring check. `evaluator.check_answer_quality`
combines both: a case is correct if results match OR all required terms are
present and no prohibited terms appear. The returned dict carries `method`
(`result_match` / `term_match` / `none`) so the UI can display *how* a case
passed.

### Test fixture

`backend/app/data/evaluation/test_queries.json` defines 10 cases split into two
categories, mirroring the rag-demo split. The five `general` cases follow
patterns close to the few-shot examples in the system prompt. The five
`exception` cases use a different metric (利益 instead of 売上), a different
quarter (Q3 instead of Q2), a different grouping dimension (エリア instead of
商品カテゴリ), or a comparison shape the few-shot doesn't show (year-over-year).
Each case carries `expected_sql` (executed against DuckDB at scoring time) and
`expected_answer_contains` populated with the actual ground-truth values
verified against the live parquet files.

### API surface

`GET /api/evaluate/queries` returns the question list — useful for previews and
external scripting. `GET /api/evaluate/stream` is the SSE endpoint the UI calls.
Internally it iterates the fixture and re-uses the existing `ask_streaming`
generator from `app.agents.sql_agent`, forwarding every event verbatim before
emitting `eval_query_start` / `eval_query_scored` / `eval_complete` markers.

### Frontend

A new `useEvaluation` hook holds an array of `QueryRecord`s — the same shape
the chat hook uses — so `QueryCard` renders test runs without modification. The
hook attaches a `Scoring` to each record on `eval_query_scored` and stores the
final `EvaluationScore` on `eval_complete`. The chat header gained a two-tab
toggle; in test mode the input bar is replaced by a single
"テストを開始" / "再実行" button. Two new components: `ScoringAnnotation` (✓/✗
badge with found terms, missing terms hint, and prohibited-term warning) and
`EvaluationSummaryBubble` (overall percentage + segmented progress bar +
per-category breakdown). `QueryCard` now renders `<ScoringAnnotation>` below the
result table when `record.scoring` is populated.

## Files Modified

| File | Change |
|------|--------|
| [backend/app/data/evaluation/evaluator.py](backend/app/data/evaluation/evaluator.py) | New scoring module: result equivalence, term presence, combined quality check |
| [backend/app/data/evaluation/test_queries.json](backend/app/data/evaluation/test_queries.json) | New 10-case fixture, 5 general + 5 exception, ground truth verified |
| [backend/app/data/evaluation/__init__.py](backend/app/data/evaluation/__init__.py) | New package marker |
| [backend/app/data/__init__.py](backend/app/data/__init__.py) | New package marker |
| [backend/app/routers/evaluation.py](backend/app/routers/evaluation.py) | New SSE evaluation router |
| [backend/app/routers/__init__.py](backend/app/routers/__init__.py) | Register evaluation_router |
| [backend/app/main.py](backend/app/main.py) | Mount new router |
| [backend/tests/test_evaluator.py](backend/tests/test_evaluator.py) | 19 new tests for scoring logic |
| [frontend/lib/types.ts](frontend/lib/types.ts) | Add Scoring, EvaluationScore, EvalSSEEvent types |
| [frontend/lib/constants.ts](frontend/lib/constants.ts) | Add eval-mode UI strings and endpoint paths |
| [frontend/lib/api.ts](frontend/lib/api.ts) | Add streamEvaluation generator; SSE helper supports GET |
| [frontend/hooks/useEvaluation.ts](frontend/hooks/useEvaluation.ts) | New hook driving the eval stream |
| [frontend/app/components/ScoringAnnotation.tsx](frontend/app/components/ScoringAnnotation.tsx) | New ✓/✗ badge component |
| [frontend/app/components/EvaluationSummaryBubble.tsx](frontend/app/components/EvaluationSummaryBubble.tsx) | New end-of-run summary bubble |
| [frontend/app/components/QueryCard.tsx](frontend/app/components/QueryCard.tsx) | Render ScoringAnnotation when record carries scoring |
| [frontend/app/components/QueryInterface.tsx](frontend/app/components/QueryInterface.tsx) | Mode tabs, conditional input/control bar |

## Guard Rails

| Scenario | Behavior |
|----------|----------|
| Agent returns a different column alias than the reference SQL | `results_equivalent` ignores column names and matches on positional values |
| Agent returns rows in a different order than the reference SQL | Both DataFrames are sorted by stringified row content before comparison |
| Agent picks semantically equivalent SQL with a slightly different shape | `check_term_presence` rescues the case if all required values appear in the result |
| Agent returns the wrong row count | `results_equivalent` fails on shape mismatch; `check_term_presence` still runs as fallback |
| Agent generates SQL that fails after retries | Per-query stream emits `sql_error`; `eval_query_scored` reports `is_correct=false` with explanation "エージェントの応答が得られませんでした" |
| User clicks "精度テスト" while a free-chat query is in flight | Mode tabs are disabled while `isLoading` is true |
| User switches modes mid-run | Tab buttons disabled during evaluation; switching is only possible after completion |

## Verification

1. **Backend unit tests:** `cd backend && uv run pytest` — should report 55 passing (was 36, +19 new evaluator tests).
2. **Backend type check:** `cd backend && uv run pyright` — 0 errors, 0 warnings.
3. **Frontend type check:** `cd frontend && pnpm typecheck` — clean exit.
4. **Frontend tests:** `cd frontend && pnpm test` — should report 34 passing.
5. **End-to-end via UI:**
   - Run `pnpm dev` to start backend and frontend together.
   - Step through the wizard to reach chat mode.
   - Click the **精度テスト** tab in the chat header → click **テストを開始**.
   - Watch the 10 questions stream into the chat one after another, each rendering as a normal `QueryCard` with thinking steps, generated SQL, and result table — followed by a green **✅ 正解** or red **❌ 不正解** annotation.
   - On completion, an **EvaluationSummaryBubble** appears with overall accuracy, a segmented progress bar, and per-category breakdown.
   - Click **自由チャット** to return to chat mode; prior chat history is preserved separately from the eval run.
6. **API smoke test:** `curl -N http://localhost:7860/api/evaluate/stream` should print SSE events including `eval_query_start`, `sql_generated`, `sql_result`, `eval_query_scored`, and a final `eval_complete` carrying `score.percentage` and `score.by_category`.

## Breaking Changes

None. The chat endpoint, ETL endpoints, and existing UI flow are unchanged.
