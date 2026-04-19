"""Tests for the accuracy evaluator scoring logic."""

import duckdb
import pandas as pd
import pytest

from app.data.evaluation.evaluator import (
    check_answer_quality,
    check_term_presence,
    load_test_queries,
    results_equivalent,
)


@pytest.fixture
def con():
    """In-memory DuckDB seeded with a small slice of the area_pl table."""
    c = duckdb.connect()
    df = pd.DataFrame(
        {
            "エリア": ["関東", "関東", "関西", "関西"],
            "年度": [2025, 2025, 2025, 2025],
            "四半期": ["Q1", "Q2", "Q1", "Q2"],
            "売上_計画": [600, 600, 400, 400],
            "売上_実績": [580, 620, 380, 410],
        }
    )
    c.register("area_pl", df)
    return c


class TestResultsEquivalent:
    def test_identical_dataframes_match(self):
        df = pd.DataFrame({"a": [1, 2, 3]})
        assert results_equivalent(df, df.copy())

    def test_reordered_rows_match(self):
        a = pd.DataFrame({"x": ["関東", "関西"], "n": [100, 200]})
        b = pd.DataFrame({"x": ["関西", "関東"], "n": [200, 100]})
        assert results_equivalent(a, b)

    def test_numerically_close_values_match(self):
        a = pd.DataFrame({"rate": [97.2]})
        b = pd.DataFrame({"rate": [97.21]})
        assert results_equivalent(a, b)

    def test_different_column_aliases_match(self):
        a = pd.DataFrame({"total": [580]})
        b = pd.DataFrame({"sum_uriage": [580]})
        assert results_equivalent(a, b)

    def test_shape_mismatch_fails(self):
        a = pd.DataFrame({"x": [1, 2]})
        b = pd.DataFrame({"x": [1, 2, 3]})
        assert not results_equivalent(a, b)

    def test_value_mismatch_fails(self):
        a = pd.DataFrame({"x": [100]})
        b = pd.DataFrame({"x": [200]})
        assert not results_equivalent(a, b)

    def test_both_empty_match(self):
        a = pd.DataFrame()
        b = pd.DataFrame()
        assert results_equivalent(a, b)


class TestCheckTermPresence:
    def test_all_required_terms_found(self):
        result = check_term_presence("関東 売上 2383", ["関東", "2383"], None)
        assert result["is_correct"]
        assert result["found_terms"] == ["関東", "2383"]
        assert result["missing_terms"] == []

    def test_missing_required_term_fails(self):
        result = check_term_presence("関東 売上", ["関東", "2383"], None)
        assert not result["is_correct"]
        assert "2383" in result["missing_terms"]

    def test_prohibited_term_overrides_required(self):
        result = check_term_presence(
            "関東 マンション 2383",
            expected_contains=["関東", "2383"],
            must_not_contain=["マンション"],
        )
        assert not result["is_correct"]
        assert result["prohibited_found"] == ["マンション"]

    def test_case_insensitive_match(self):
        result = check_term_presence("Q2 RANKING", ["q2"], None)
        assert result["is_correct"]


class TestCheckAnswerQuality:
    def test_results_match_passes(self, con):
        # Agent generated query produces same answer with different alias
        gen_df = pd.DataFrame({"sum_x": [580 + 620]})
        scoring = check_answer_quality(
            generated_result_df=gen_df,
            expected_sql='SELECT SUM("売上_実績") AS total FROM area_pl WHERE "エリア" = \'関東\'',
            expected_contains=["1200"],
            must_not_contain=None,
            con=con,
        )
        assert scoring["is_correct"]
        assert scoring["results_match"]
        assert scoring["method"] == "result_match"

    def test_term_match_passes_when_results_differ(self, con):
        # Agent returned extra column but answer is in there
        gen_df = pd.DataFrame({"エリア": ["関東"], "total": [1200]})
        scoring = check_answer_quality(
            generated_result_df=gen_df,
            expected_sql='SELECT SUM("売上_実績") FROM area_pl WHERE "エリア" = \'関東\'',
            expected_contains=["1200"],
            must_not_contain=None,
            con=con,
        )
        assert scoring["is_correct"]
        assert not scoring["results_match"]
        assert scoring["method"] == "term_match"

    def test_wrong_answer_fails(self, con):
        gen_df = pd.DataFrame({"total": [9999]})
        scoring = check_answer_quality(
            generated_result_df=gen_df,
            expected_sql='SELECT SUM("売上_実績") FROM area_pl WHERE "エリア" = \'関東\'',
            expected_contains=["1200"],
            must_not_contain=None,
            con=con,
        )
        assert not scoring["is_correct"]
        assert "1200" in scoring["missing_terms"]

    def test_prohibited_term_in_result_fails(self, con):
        gen_df = pd.DataFrame({"商品カテゴリ": ["戸建", "マンション"], "x": [1, 2]})
        scoring = check_answer_quality(
            generated_result_df=gen_df,
            expected_sql='SELECT \'戸建\' AS c, 1 AS x',
            expected_contains=["戸建"],
            must_not_contain=["マンション"],
            con=con,
        )
        assert not scoring["is_correct"]
        assert scoring["prohibited_found"] == ["マンション"]

    def test_no_result_dataframe_fails_gracefully(self, con):
        scoring = check_answer_quality(
            generated_result_df=None,
            expected_sql="SELECT 1",
            expected_contains=["foo"],
            must_not_contain=None,
            con=con,
        )
        assert not scoring["is_correct"]


class TestLoadTestQueries:
    def test_loads_at_least_ten_queries(self):
        queries = load_test_queries()
        assert len(queries) >= 10

    def test_each_query_has_required_fields(self):
        queries = load_test_queries()
        required = {"id", "category", "question", "expected_sql", "expected_answer_contains"}
        for q in queries:
            assert required.issubset(q.keys()), f"{q.get('id')} missing fields"

    def test_categories_split(self):
        queries = load_test_queries()
        cats = {q["category"] for q in queries}
        assert "general" in cats
        assert "exception" in cats
