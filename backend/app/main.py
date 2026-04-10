"""FastAPI application for the agentic SQL educational demo."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, RedirectResponse

from app.config import settings
from app.routers import chat_router, etl_router, schema_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """On startup: ensure Parquet files exist, load DuckDB."""
    from etl.excel_to_parquet import run_etl
    from agent.sql_agent import load_database

    processed_dir = settings.PROCESSED_DIR
    area_parquet = processed_dir / "area_pl.parquet"
    product_parquet = processed_dir / "product_sales.parquet"

    if not area_parquet.exists() or not product_parquet.exists():
        logger.info("Parquet files not found — running ETL...")
        run_etl(raw_dir=settings.RAW_DIR, processed_dir=processed_dir)
        logger.info("ETL complete.")

    logger.info("Loading DuckDB from Parquet files...")
    app.state.con = load_database(processed_dir)
    logger.info("DuckDB ready.")

    settings.validate()

    yield

    app.state.con.close()
    logger.info("DuckDB connection closed.")


app = FastAPI(
    title="Agentic SQL Demo API",
    description="SSE streaming text-to-SQL pipeline with educational step visualization",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to Vercel domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(schema_router)
app.include_router(etl_router)


@app.get("/")
async def root():
    return RedirectResponse(url="/docs")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/healthz")
async def healthz():
    """Lightweight liveness probe for keep-alive pings."""
    return PlainTextResponse("ok")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
