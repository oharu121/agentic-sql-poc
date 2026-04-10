# test_queries.py
# Demo: runs 3 natural language questions through the agent and prints results.
# Requires: Ollama running locally with gemma4:e4b pulled (ollama list to verify).
# Run: uv run python test_queries.py

from pathlib import Path

from agent.sql_agent import ask, load_database
from etl.excel_to_parquet import run_etl

QUESTIONS = [
    # Q1: simple filter + aggregation (same as before — not in few-shot examples)
    "関東エリアの今期（2025年度）累計売上実績は？",
    # Q2: grouped aggregation + ratio (novel — few-shot example uses 売上, this uses 利益)
    "2025年度で利益の計画達成率が最も高いエリアはどこですか？",
    # Q3: grouped ranking (novel — few-shot example uses Q2+商品, this uses Q3+エリア)
    "2025年度Q3のエリア別受注実績ランキングを出してください。",
]


def main():
    processed_dir = Path("data/processed")

    # Run ETL if Parquet files don't exist yet
    if not all((processed_dir / f).exists() for f in ["area_pl.parquet", "product_sales.parquet"]):
        print("Parquet files not found — running ETL first...\n")
        run_etl()

    print("Loading database...")
    con = load_database(processed_dir)

    for question in QUESTIONS:
        print(f"\n{'=' * 70}")
        print(f"Q: {question}")
        result = ask(question, con)
        print(f"\nGenerated SQL:\n{result['sql']}")
        print(f"\nResult:\n{result['result'].to_string(index=False)}")

    print(f"\n{'=' * 70}")
    print("Done.")


if __name__ == "__main__":
    main()
