# tests/test_agent.py
import pandas as pd
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from agent.sql_agent import build_system_prompt, load_database, ask
from sql.schema import (
    AREA_PL_TABLE, AREA_PL_COLUMNS,
    PRODUCT_SALES_TABLE, PRODUCT_SALES_COLUMNS,
    AREA_VALUES, PRODUCT_CATEGORY_VALUES,
)


class TestBuildSystemPrompt:
    def test_includes_both_table_names(self):
        prompt = build_system_prompt()
        assert AREA_PL_TABLE in prompt
        assert PRODUCT_SALES_TABLE in prompt

    def test_includes_all_area_pl_columns(self):
        prompt = build_system_prompt()
        for col in AREA_PL_COLUMNS:
            assert col in prompt, f"Column '{col}' missing from system prompt"

    def test_includes_all_product_sales_columns(self):
        prompt = build_system_prompt()
        for col in PRODUCT_SALES_COLUMNS:
            assert col in prompt, f"Column '{col}' missing from system prompt"

    def test_includes_area_values(self):
        prompt = build_system_prompt()
        for area in AREA_VALUES:
            assert area in prompt, f"Area value '{area}' missing from system prompt"

    def test_includes_product_category_values(self):
        prompt = build_system_prompt()
        for cat in PRODUCT_CATEGORY_VALUES:
            assert cat in prompt, f"Product category '{cat}' missing from system prompt"

    def test_mentions_double_quotes_for_japanese_columns(self):
        prompt = build_system_prompt()
        # Prompt must instruct the model to use double quotes for Japanese column names
        assert "double quote" in prompt.lower() or "ダブルクォート" in prompt


class TestLoadDatabase:
    def test_registers_both_tables(self, tmp_path):
        area_df = pd.DataFrame({
            "エリア": ["関東"], "年度": [2024], "四半期": ["Q1"],
            "売上_計画": [500], "売上_実績": [480],
            "利益_計画": [90], "利益_実績": [85],
            "受注_計画": [580], "受注_実績": [560],
        })
        prod_df = pd.DataFrame({
            "商品カテゴリ": ["戸建"], "エリア": ["関東"], "年度": [2024], "四半期": ["Q1"],
            "売上_計画": [225], "売上_実績": [216],
        })
        area_df.to_parquet(tmp_path / "area_pl.parquet", index=False)
        prod_df.to_parquet(tmp_path / "product_sales.parquet", index=False)

        con = load_database(tmp_path)

        tables = con.execute("SHOW TABLES").fetchall()
        table_names = [t[0] for t in tables]
        assert AREA_PL_TABLE in table_names
        assert PRODUCT_SALES_TABLE in table_names

    def test_tables_are_queryable(self, tmp_path):
        area_df = pd.DataFrame({
            "エリア": ["関東", "関西"], "年度": [2024, 2024], "四半期": ["Q1", "Q1"],
            "売上_計画": [500, 300], "売上_実績": [480, 290],
            "利益_計画": [90, 54], "利益_実績": [85, 50],
            "受注_計画": [580, 350], "受注_実績": [560, 330],
        })
        prod_df = pd.DataFrame({
            "商品カテゴリ": ["戸建"], "エリア": ["関東"], "年度": [2024], "四半期": ["Q1"],
            "売上_計画": [225], "売上_実績": [216],
        })
        area_df.to_parquet(tmp_path / "area_pl.parquet", index=False)
        prod_df.to_parquet(tmp_path / "product_sales.parquet", index=False)

        con = load_database(tmp_path)
        count = con.execute(f'SELECT COUNT(*) FROM {AREA_PL_TABLE}').fetchone()[0]
        assert count == 2


class TestAsk:
    def test_returns_question_sql_and_result(self, tmp_path):
        area_df = pd.DataFrame({
            "エリア": ["関東"], "年度": [2025], "四半期": ["Q1"],
            "売上_計画": [525], "売上_実績": [510],
            "利益_計画": [95], "利益_実績": [90],
            "受注_計画": [610], "受注_実績": [595],
        })
        prod_df = pd.DataFrame({
            "商品カテゴリ": ["戸建"], "エリア": ["関東"], "年度": [2025], "四半期": ["Q1"],
            "売上_計画": [236], "売上_実績": [229],
        })
        area_df.to_parquet(tmp_path / "area_pl.parquet", index=False)
        prod_df.to_parquet(tmp_path / "product_sales.parquet", index=False)

        con = load_database(tmp_path)

        # Mock ollama.chat to return valid SQL without hitting the local server
        mock_response = MagicMock()
        mock_response.message.content = 'SELECT SUM("売上_実績") AS total FROM area_pl'

        with patch("agent.sql_agent.ollama.chat", return_value=mock_response):
            result = ask("関東の売上は？", con)

        assert "question" in result
        assert "sql" in result
        assert "result" in result
        assert isinstance(result["result"], pd.DataFrame)
        assert result["result"].iloc[0]["total"] == 510

    def test_ask_raises_runtime_error_on_invalid_sql(self, tmp_path):
        area_df = pd.DataFrame({
            "エリア": ["関東"], "年度": [2025], "四半期": ["Q1"],
            "売上_計画": [525], "売上_実績": [510],
            "利益_計画": [95], "利益_実績": [90],
            "受注_計画": [610], "受注_実績": [595],
        })
        prod_df = pd.DataFrame({
            "商品カテゴリ": ["戸建"], "エリア": ["関東"], "年度": [2025], "四半期": ["Q1"],
            "売上_計画": [236], "売上_実績": [229],
        })
        area_df.to_parquet(tmp_path / "area_pl.parquet", index=False)
        prod_df.to_parquet(tmp_path / "product_sales.parquet", index=False)

        con = load_database(tmp_path)

        mock_response = MagicMock()
        mock_response.message.content = "this is not valid SQL at all"

        with patch("agent.sql_agent.ollama.chat", return_value=mock_response):
            with pytest.raises(RuntimeError, match="SQL execution failed"):
                ask("何か？", con)
