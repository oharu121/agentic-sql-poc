# test_queries.py
# Demo: runs 3 natural language questions through the agent and prints results.
# Requires: Ollama running locally with gemma4:e4b pulled (ollama list to verify).
# Run: uv run python test_queries.py

from pathlib import Path

from agent.sql_agent import ask, load_database
from etl.excel_to_parquet import run_etl

QUESTIONS = [
    "関東エリアの今期（2025年度）累計売上実績は？",
    "全エリアで2025年度の計画比達成率が最も低いのはどこか？",
    "2025年度Q2の商品別売上ランキングを教えてください。",
]


def main():
    processed_dir = Path("data/processed")

    # Run ETL if Parquet files don't exist yet
    if not (processed_dir / "area_pl.parquet").exists():
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
