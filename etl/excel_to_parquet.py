# etl/excel_to_parquet.py
from pathlib import Path

import pandas as pd

from sql.schema import (
    AREA_PL_COLUMNS,
    AREA_PL_TABLE,
    PRODUCT_SALES_COLUMNS,
    PRODUCT_SALES_TABLE,
)


def validate_columns(df: pd.DataFrame, required_columns: list[str], file_name: str) -> None:
    missing = set(required_columns) - set(df.columns)
    if missing:
        raise ValueError(f"{file_name}: missing columns: {sorted(missing)}")


def validate_types(df: pd.DataFrame, column_types: dict[str, str], file_name: str) -> None:
    for col, dtype in column_types.items():
        if col not in df.columns:
            continue  # validate_columns handles missing columns
        if dtype == "INTEGER" and not pd.api.types.is_numeric_dtype(df[col]):
            raise TypeError(
                f"{file_name}: column '{col}' must be numeric (INTEGER), "
                f"got {df[col].dtype}"
            )


def convert_excel_to_parquet(
    excel_path: Path,
    output_path: Path,
    required_columns: list[str],
    column_types: dict[str, str],
) -> None:
    df = pd.read_excel(excel_path)
    validate_columns(df, required_columns, excel_path.name)
    validate_types(df, column_types, excel_path.name)

    for col, dtype in column_types.items():
        if dtype == "INTEGER":
            df[col] = df[col].astype("int64")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df[required_columns].to_parquet(output_path, index=False)


def run_etl(raw_dir: Path = Path("data/raw"), processed_dir: Path = Path("data/processed")) -> None:
    """Convert both Excel files to Parquet. Call this before running the agent."""
    files = [
        (
            raw_dir / "エリア収支.xlsx",
            processed_dir / f"{AREA_PL_TABLE}.parquet",
            list(AREA_PL_COLUMNS.keys()),
            AREA_PL_COLUMNS,
        ),
        (
            raw_dir / "商品別売上.xlsx",
            processed_dir / f"{PRODUCT_SALES_TABLE}.parquet",
            list(PRODUCT_SALES_COLUMNS.keys()),
            PRODUCT_SALES_COLUMNS,
        ),
    ]
    for excel_path, output_path, cols, types in files:
        convert_excel_to_parquet(excel_path, output_path, cols, types)
        print(f"  {excel_path.name} → {output_path.name}")


if __name__ == "__main__":
    print("Running ETL...")
    run_etl()
    print("Done.")
