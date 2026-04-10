"""Query router — POST /api/query streams the SQL pipeline as SSE."""

import json
import logging
import time

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.models import QueryRequest
from app.agents.sql_agent import ask_streaming

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["query"])


def format_sse(event: str, data: dict) -> str:
    """Format a server-sent event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _stream_query(request: QueryRequest, con):
    start = time.time()
    logger.info(f"Query request: question_length={len(request.question)}")

    try:
        async for event_type, payload in ask_streaming(request.question, con):
            yield format_sse(event_type, payload)
    except Exception as exc:
        logger.error(f"STREAM_ERROR: {type(exc).__name__}: {exc}", exc_info=True)
        yield format_sse("sql_error", {"message": str(exc), "final_sql": ""})
        return

    processing_time_ms = int((time.time() - start) * 1000)
    yield format_sse("done", {"processing_time_ms": processing_time_ms})


@router.post("/query")
async def query(request_body: QueryRequest, request: Request):
    """SSE streaming endpoint: natural language question → SQL → DuckDB result."""
    con = request.app.state.con
    return StreamingResponse(
        _stream_query(request_body, con),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
