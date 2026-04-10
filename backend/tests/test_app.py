"""Tests for FastAPI endpoints and the streaming SQL agent."""

import json
import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from agent.sql_agent import load_database
from app.main import app


# ── Shared fixture ────────────────────────────────────────────────────────────

@pytest.fixture
async def db_client(tmp_path):
    """AsyncClient backed by the ASGI app with an injected test DuckDB connection.

    Uses ASGITransport without a context-manager lifespan so the real startup
    (ETL + GEMINI_API_KEY check) is bypassed; app.state.con is set manually.
    """
    area_df = pd.DataFrame({
        "エリア": ["関東", "関西"],
        "年度": [2025, 2025],
        "四半期": ["Q1", "Q1"],
        "売上_計画": [500, 300],
        "売上_実績": [480, 290],
        "利益_計画": [90, 54],
        "利益_実績": [85, 50],
        "受注_計画": [580, 350],
        "受注_実績": [560, 330],
    })
    prod_df = pd.DataFrame({
        "商品カテゴリ": ["戸建"],
        "エリア": ["関東"],
        "年度": [2025],
        "四半期": ["Q1"],
        "売上_計画": [225],
        "売上_実績": [216],
    })
    area_df.to_parquet(tmp_path / "area_pl.parquet", index=False)
    prod_df.to_parquet(tmp_path / "product_sales.parquet", index=False)

    app.state.con = load_database(tmp_path)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    app.state.con.close()


# ── Health endpoints ───────────────────────────────────────────────────────────

class TestHealthEndpoints:
    async def test_health_returns_ok(self, db_client):
        resp = await db_client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    async def test_healthz_returns_text_ok(self, db_client):
        resp = await db_client.get("/healthz")
        assert resp.status_code == 200
        assert resp.text == "ok"


# ── Schema endpoint ────────────────────────────────────────────────────────────

class TestSchemaEndpoint:
    async def test_returns_both_tables(self, db_client):
        resp = await db_client.get("/api/schema")
        assert resp.status_code == 200
        names = [t["name"] for t in resp.json()["tables"]]
        assert "area_pl" in names
        assert "product_sales" in names

    async def test_tables_include_columns_with_name_and_type(self, db_client):
        resp = await db_client.get("/api/schema")
        tables = {t["name"]: t for t in resp.json()["tables"]}
        col = tables["area_pl"]["columns"][0]
        assert "name" in col and "type" in col

    async def test_tables_include_enum_values(self, db_client):
        resp = await db_client.get("/api/schema")
        tables = {t["name"]: t for t in resp.json()["tables"]}
        assert "エリア" in tables["area_pl"]["enum_values"]
        assert len(tables["area_pl"]["enum_values"]["エリア"]) > 0

    async def test_tables_include_sample_rows(self, db_client):
        resp = await db_client.get("/api/schema")
        tables = {t["name"]: t for t in resp.json()["tables"]}
        assert len(tables["area_pl"]["sample_rows"]) > 0


# ── ETL preview endpoint ───────────────────────────────────────────────────────

class TestETLPreviewEndpoint:
    async def test_preview_area_pl_success(self, db_client):
        # Reads the committed Parquet file from backend/data/processed/
        resp = await db_client.get("/api/etl/preview/area_pl")
        assert resp.status_code == 200
        data = resp.json()
        assert data["table"] == "area_pl"
        assert len(data["columns"]) > 0
        assert len(data["rows"]) > 0

    async def test_preview_product_sales_success(self, db_client):
        resp = await db_client.get("/api/etl/preview/product_sales")
        assert resp.status_code == 200
        assert resp.json()["table"] == "product_sales"

    async def test_preview_unknown_table_returns_404(self, db_client):
        resp = await db_client.get("/api/etl/preview/unknown_table")
        assert resp.status_code == 404

    async def test_preview_rows_capped_at_20(self, db_client):
        resp = await db_client.get("/api/etl/preview/area_pl")
        assert len(resp.json()["rows"]) <= 20


# ── ask_streaming async generator ─────────────────────────────────────────────

def _parquet_db(tmp_path):
    """Create minimal Parquet files and return a loaded DuckDB connection."""
    area_df = pd.DataFrame({
        "エリア": ["関東"], "年度": [2025], "四半期": ["Q1"],
        "売上_計画": [500], "売上_実績": [480],
        "利益_計画": [90], "利益_実績": [85],
        "受注_計画": [580], "受注_実績": [560],
    })
    prod_df = pd.DataFrame({
        "商品カテゴリ": ["戸建"], "エリア": ["関東"], "年度": [2025], "四半期": ["Q1"],
        "売上_計画": [225], "売上_実績": [216],
    })
    area_df.to_parquet(tmp_path / "area_pl.parquet", index=False)
    prod_df.to_parquet(tmp_path / "product_sales.parquet", index=False)
    return load_database(tmp_path)


class TestAskStreaming:
    async def test_yields_all_expected_event_types_on_success(self, tmp_path):
        from app.agents.sql_agent import ask_streaming

        con = _parquet_db(tmp_path)
        with patch(
            "app.agents.sql_agent.call_llm",
            new_callable=AsyncMock,
            return_value='SELECT SUM("売上_実績") AS total FROM area_pl',
        ):
            events = [e async for e in ask_streaming("関東の売上は？", con)]

        event_types = {e[0] for e in events}
        assert "thinking_step" in event_types
        assert "sql_generated" in event_types
        assert "sql_result" in event_types

    async def test_yields_sql_error_on_non_select_statement(self, tmp_path):
        from app.agents.sql_agent import ask_streaming

        con = _parquet_db(tmp_path)
        with patch(
            "app.agents.sql_agent.call_llm",
            new_callable=AsyncMock,
            return_value="DELETE FROM area_pl",
        ):
            events = [e async for e in ask_streaming("何か？", con)]

        assert any(e[0] == "sql_error" for e in events)

    async def test_result_rows_are_json_serialisable(self, tmp_path):
        """Numpy scalars from DuckDB must be converted to Python natives."""
        from app.agents.sql_agent import ask_streaming

        con = _parquet_db(tmp_path)
        with patch(
            "app.agents.sql_agent.call_llm",
            new_callable=AsyncMock,
            return_value='SELECT "売上_実績" FROM area_pl',
        ):
            events = [e async for e in ask_streaming("売上は？", con)]

        result_events = [e for e in events if e[0] == "sql_result"]
        assert len(result_events) == 1
        json.dumps(result_events[0][1])  # must not raise TypeError

    async def test_retry_loop_yields_sql_retry_on_bad_sql(self, tmp_path):
        from app.agents.sql_agent import ask_streaming

        con = _parquet_db(tmp_path)
        # First call returns bad SQL; second call returns valid SQL
        with patch("app.agents.sql_agent.call_llm", new_callable=AsyncMock) as mock_llm:
            mock_llm.side_effect = [
                "SELECT * FROM nonexistent_table",           # attempt 1 → DuckDB error
                'SELECT SUM("売上_実績") AS t FROM area_pl', # attempt 2 → success
            ]
            events = [e async for e in ask_streaming("売上は？", con)]

        event_types = [e[0] for e in events]
        assert "sql_retry" in event_types
        assert "sql_result" in event_types


# ── Config validation ─────────────────────────────────────────────────────────

class TestConfig:
    def test_validate_raises_when_gemini_key_missing(self):
        from app.config import Settings

        s = Settings()
        s.LLM_BACKEND = "gemini"
        s.GEMINI_API_KEY = ""
        with pytest.raises(ValueError, match="GEMINI_API_KEY"):
            s.validate()

    def test_validate_passes_when_using_ollama_without_key(self):
        from app.config import Settings

        s = Settings()
        s.LLM_BACKEND = "ollama"
        s.GEMINI_API_KEY = ""
        s.validate()  # should not raise

    def test_validate_passes_when_gemini_key_is_present(self):
        from app.config import Settings

        s = Settings()
        s.LLM_BACKEND = "gemini"
        s.GEMINI_API_KEY = "test-key-xxx"
        s.validate()  # should not raise
