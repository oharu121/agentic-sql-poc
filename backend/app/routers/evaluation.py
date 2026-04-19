"""Evaluation router — runs the test query suite through the agent and streams scoring."""

import json
import logging
import time

import pandas as pd
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.agents.sql_agent import ask_streaming
from app.data.evaluation.evaluator import (
    check_answer_quality,
    load_test_queries,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/evaluate", tags=["evaluation"])


def _format_sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.get("/queries")
async def get_queries():
    """Return the test query list (for the frontend to preview before running)."""
    queries = load_test_queries()
    return {
        "queries": [
            {
                "id": q["id"],
                "category": q["category"],
                "difficulty": q.get("difficulty"),
                "question": q["question"],
            }
            for q in queries
        ]
    }


async def _stream_evaluation(con):
    queries = load_test_queries()
    total = len(queries)
    correct_count = 0
    by_category: dict[str, dict[str, int]] = {}

    eval_start = time.time()

    for index, query in enumerate(queries):
        category = query["category"]
        by_category.setdefault(category, {"correct": 0, "total": 0})
        by_category[category]["total"] += 1

        yield _format_sse(
            "eval_query_start",
            {
                "id": query["id"],
                "category": category,
                "difficulty": query.get("difficulty"),
                "question": query["question"],
                "index": index,
                "total": total,
            },
        )

        result_df: pd.DataFrame | None = None
        agent_succeeded = False
        query_start = time.time()

        try:
            async for event_type, payload in ask_streaming(query["question"], con):
                # Forward agent events to the frontend so QueryCard renders identically
                yield _format_sse(event_type, payload)

                if event_type == "sql_result":
                    result_df = pd.DataFrame(payload["rows"], columns=payload["columns"])
                    agent_succeeded = True
        except Exception as exc:
            logger.error(f"Agent stream failed for {query['id']}: {exc}", exc_info=True)
            yield _format_sse("sql_error", {"message": str(exc), "final_sql": ""})

        # Per-query "done" so the frontend can finalize the QueryCard before showing scoring
        yield _format_sse(
            "done",
            {"processing_time_ms": int((time.time() - query_start) * 1000)},
        )

        # Score this query
        if agent_succeeded and result_df is not None:
            scoring = check_answer_quality(
                generated_result_df=result_df,
                expected_sql=query["expected_sql"],
                expected_contains=query["expected_answer_contains"],
                must_not_contain=query.get("expected_answer_must_not_contain"),
                con=con,
            )
        else:
            scoring = {
                "is_correct": False,
                "method": "none",
                "results_match": False,
                "found_terms": [],
                "missing_terms": query["expected_answer_contains"],
                "prohibited_found": [],
                "explanation": "エージェントの応答が得られませんでした",
            }

        if scoring["is_correct"]:
            correct_count += 1
            by_category[category]["correct"] += 1

        yield _format_sse(
            "eval_query_scored",
            {"id": query["id"], "scoring": scoring},
        )

    percentage = round(correct_count / total * 100, 1) if total > 0 else 0.0
    by_category_payload = {
        cat: {
            "correct": stats["correct"],
            "total": stats["total"],
            "percentage": round(stats["correct"] / stats["total"] * 100, 1) if stats["total"] else 0.0,
        }
        for cat, stats in by_category.items()
    }

    yield _format_sse(
        "eval_complete",
        {
            "score": {
                "correct": correct_count,
                "total": total,
                "percentage": percentage,
                "by_category": by_category_payload,
            },
            "processing_time_ms": int((time.time() - eval_start) * 1000),
        },
    )


@router.get("/stream")
async def stream(request: Request):
    """SSE: run all test queries through the agent, scoring each one."""
    con = request.app.state.con
    return StreamingResponse(
        _stream_evaluation(con),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
