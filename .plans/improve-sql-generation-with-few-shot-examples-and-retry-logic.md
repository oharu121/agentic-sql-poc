# Plan: Improve SQL generation with few-shot examples and retry logic

**Status:** Completed
**Date:** 2026-04-08

## Context

The Ollama gemma4:e4b model was generating broken SQL for questions requiring grouped aggregations. For example, when asked "全エリアで2025年度の計画比達成率が最も低いのはどこか？", the model produced `SELECT "エリア", CAST("売上_実績" AS REAL) / "売上_計画" AS "達成率"` — using bare columns without `SUM()` despite a `GROUP BY` clause. This failed with a DuckDB `BinderException` because columns referenced in SELECT must be aggregated or included in GROUP BY.

The root cause is that the LLM didn't understand the data granularity: each table has one row per (エリア, 四半期) combination, so computing ratios across areas requires `SUM(x)/SUM(y)`, not `x/y`. Additionally, the agent had no recovery mechanism — a single SQL error terminated the entire request.

## Approach

Two complementary techniques, tested independently to measure their individual impact:

1. **Retry with error feedback** — when DuckDB execution fails, feed the error message back to the LLM as a follow-up message and let it self-correct. This exploits the fact that DuckDB errors are very specific (e.g., "column X must appear in GROUP BY or aggregate function"), giving the LLM an actionable hint. Tested first in isolation to measure self-correction ability.

2. **Few-shot examples in the system prompt** — add 2 reference queries from `sql/queries.py` showing the correct grouped aggregation pattern. This teaches the pattern at generation time rather than relying on post-hoc correction. Tested with novel questions (different columns, quarters, tables) to verify the model generalizes the pattern rather than memorizing answers.

A granularity hint was also added to the system prompt: "Each table has one row per (エリア, 四半期) combination. When comparing across areas or categories, always use SUM() to aggregate over quarters."

## Changes

### 1. Retry logic in `ask()`

The `ask()` function was restructured from a single LLM call to a retry loop (up to `MAX_RETRIES=2`, so 3 total attempts). On `duckdb.Error`, the failed SQL is appended as an assistant message and the error as a user message, preserving conversational context. The non-SELECT safety guard still raises immediately without retry. A `_extract_sql()` helper was extracted for the fence-stripping logic reused across attempts.

### 2. Few-shot examples in `build_system_prompt()`

Two reference queries are imported from `sql.queries.QUERIES` via `_FEW_SHOT_KEYS` and formatted as compact Q/A pairs by `_build_few_shot_section()`. The multi-line SQL from `queries.py` is collapsed to single lines via `" ".join(sql.split())`. The examples cover: grouped aggregation with ratio calculation, and grouped ranking with ordering.

### 3. Novel test questions

`test_queries.py` questions Q2 and Q3 were replaced with novel questions that test the same patterns but use different columns/quarters: profit achievement rate (利益) instead of sales (売上), and Q3 area-level order ranking (受注) instead of Q2 product-level sales ranking. This validates generalization.

## Files Modified

| File | Change |
|------|--------|
| [agent/sql_agent.py](agent/sql_agent.py) | Added retry loop, few-shot examples, granularity hint, extracted `_extract_sql()` |
| [test_queries.py](test_queries.py) | Replaced Q2/Q3 with novel questions to test generalization |

## Guard Rails

| Scenario | Behavior |
|----------|----------|
| LLM returns non-SELECT SQL | Raises `RuntimeError` immediately — no retry (safety violation) |
| SQL fails all 3 attempts | Raises `RuntimeError` with "after 3 attempts", last SQL, and error |
| LLM "fixes" error with `ANY_VALUE()` | Produces wrong results silently — retry can't catch semantic errors |
| Few-shot keys missing from QUERIES dict | `KeyError` at import time — fails fast |

## Verification

```bash
uv run pytest                    # 19 tests should pass
uv run python test_queries.py    # All 3 novel questions should produce correct results
```

Expected results:
- Q1: 関東 cumulative sales = 2383
- Q2: 中部 has highest profit achievement rate (100.5%)
- Q3: Area ranking by Q3 受注: 関東 610, 関西 362, 中部 284, 九州 172, 東北 103

## Breaking Changes

None — `ask()` return type and `load_database()` interface unchanged.
