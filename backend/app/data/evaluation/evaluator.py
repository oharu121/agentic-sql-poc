"""Accuracy evaluator for the text-to-SQL agent.

Scoring combines two independent checks:
  1. Result-equivalence: execute expected_sql, compare its DataFrame to the
     agent's result DataFrame (sort-insensitive, numeric-tolerant).
  2. Term-presence: stringified rows contain all required terms and none of
     the prohibited terms (mirrors the rag-demo pattern).

A case passes if either check passes, so alternate SQL formulations with
different column aliases still count as correct as long as the answer appears.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import duckdb
import numpy as np
import pandas as pd


TEST_QUERIES_PATH = Path(__file__).parent / "test_queries.json"


def load_test_queries(path: Optional[Path] = None) -> list[dict]:
    """Load the test query fixture as a list of dicts."""
    p = path or TEST_QUERIES_PATH
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["queries"]


def results_equivalent(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    rtol: float = 0.01,
    atol: float = 0.5,
) -> bool:
    """Return True if two DataFrames carry the same answer.

    Shape must match. Numeric columns compare with numpy.isclose; object/string
    columns compare via str() equality. Column names are ignored so the agent
    can pick any alias.
    """
    if df_a.shape != df_b.shape:
        return False
    if df_a.empty and df_b.empty:
        return True

    # Sort both by stringified row content to align rows regardless of ORDER BY choice
    def _sort_key(df: pd.DataFrame) -> pd.DataFrame:
        key = df.astype(str).agg("|".join, axis=1)
        return df.iloc[key.argsort(kind="stable")].reset_index(drop=True)

    a = _sort_key(df_a)
    b = _sort_key(df_b)

    for col_a, col_b in zip(a.columns, b.columns):
        sa = a[col_a]
        sb = b[col_b]
        # Both numeric: allow tolerance
        if pd.api.types.is_numeric_dtype(sa) and pd.api.types.is_numeric_dtype(sb):
            if not np.allclose(sa.to_numpy(dtype=float), sb.to_numpy(dtype=float), rtol=rtol, atol=atol, equal_nan=True):
                return False
        else:
            if not (sa.astype(str).to_numpy() == sb.astype(str).to_numpy()).all():
                return False
    return True


def _df_to_searchable_text(df: Optional[pd.DataFrame]) -> str:
    """Flatten a DataFrame into a single string so term checks can scan it."""
    if df is None or df.empty:
        return ""
    header = " ".join(str(c) for c in df.columns)
    body = " ".join(df.astype(str).agg(" ".join, axis=1).tolist())
    return f"{header} {body}"


def check_term_presence(
    haystack: str,
    expected_contains: list[str],
    must_not_contain: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Check required and prohibited term presence. Case-insensitive."""
    haystack_lower = haystack.lower()

    found_terms: list[str] = []
    missing_terms: list[str] = []
    for term in expected_contains:
        if term.lower() in haystack_lower or term in haystack:
            found_terms.append(term)
        else:
            missing_terms.append(term)

    prohibited_found: list[str] = []
    if must_not_contain:
        for term in must_not_contain:
            if term.lower() in haystack_lower or term in haystack:
                prohibited_found.append(term)

    has_required = len(expected_contains) == 0 or len(missing_terms) == 0
    has_prohibited = len(prohibited_found) > 0
    is_correct = has_required and not has_prohibited

    return {
        "is_correct": is_correct,
        "found_terms": found_terms,
        "missing_terms": missing_terms,
        "prohibited_found": prohibited_found,
    }


def check_answer_quality(
    generated_result_df: Optional[pd.DataFrame],
    expected_sql: str,
    expected_contains: list[str],
    must_not_contain: Optional[list[str]],
    con: duckdb.DuckDBPyConnection,
) -> dict[str, Any]:
    """Combined scoring: result-equivalence OR term-presence.

    Returns a unified scoring dict:
      is_correct, method, found_terms, missing_terms, prohibited_found,
      explanation, results_match
    """
    # 1. Result equivalence
    results_match = False
    if generated_result_df is not None:
        try:
            expected_df: pd.DataFrame = con.execute(expected_sql).df()
            results_match = results_equivalent(expected_df, generated_result_df)
        except duckdb.Error:
            results_match = False

    # 2. Term presence
    haystack = _df_to_searchable_text(generated_result_df)
    term_check = check_term_presence(haystack, expected_contains, must_not_contain)

    is_correct = results_match or term_check["is_correct"]

    if is_correct and results_match:
        explanation = "結果が期待値と一致しました"
        method = "result_match"
    elif is_correct:
        explanation = "期待される値が回答に含まれています"
        method = "term_match"
    elif term_check["prohibited_found"]:
        explanation = "誤った値が含まれています"
        method = "none"
    elif term_check["missing_terms"]:
        explanation = "期待される値が見つかりません"
        method = "none"
    else:
        explanation = "回答が得られませんでした"
        method = "none"

    return {
        "is_correct": is_correct,
        "method": method,
        "results_match": results_match,
        "found_terms": term_check["found_terms"],
        "missing_terms": term_check["missing_terms"],
        "prohibited_found": term_check["prohibited_found"],
        "explanation": explanation,
    }
