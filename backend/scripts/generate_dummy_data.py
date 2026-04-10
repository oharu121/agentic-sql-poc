# scripts/generate_dummy_data.py
# Generates realistic Excel files in data/raw/.
# Run: uv run python scripts/generate_dummy_data.py

import numpy as np
import pandas as pd
from pathlib import Path

from sql.schema import AREA_VALUES, YEAR_VALUES, QUARTER_VALUES, PRODUCT_CATEGORY_VALUES

rng = np.random.default_rng(42)

AREAS = AREA_VALUES
YEARS = YEAR_VALUES
QUARTERS = QUARTER_VALUES
PRODUCTS = PRODUCT_CATEGORY_VALUES

# Quarterly sales plan base (百万円), indexed Q1–Q4
AREA_BASE_PLAN = {
    "関東": [500, 540, 520, 580],
    "関西": [300, 320, 310, 340],
    "中部": [220, 240, 230, 260],
    "九州": [150, 160, 150, 170],
    "東北": [80, 88, 82, 95],
}

# 5% YoY growth on plan for 2025
YOY_GROWTH = 1.05

# Predetermined underperforming quarters (bias applied to actual/plan ratio)
UNDERPERFORM_BIAS = {
    ("九州", 2024, "Q3"): -0.15,
    ("東北", 2025, "Q2"): -0.12,
    ("中部", 2024, "Q4"): -0.08,
    ("関西", 2025, "Q1"): -0.10,
}


def calc_actual(plan: int, area: str, year: int, quarter: str) -> int:
    bias = UNDERPERFORM_BIAS.get((area, year, quarter), 0.0)
    noise = rng.uniform(-0.05, 0.10)
    return max(1, round(plan * (1.0 + bias + noise)))


def generate_area_pl() -> pd.DataFrame:
    rows = []
    for year in YEARS:
        yr_factor = 1.0 if year == 2024 else YOY_GROWTH
        for area in AREAS:
            for q_idx, quarter in enumerate(QUARTERS):
                plan = round(AREA_BASE_PLAN[area][q_idx] * yr_factor)
                actual = calc_actual(plan, area, year, quarter)
                profit_plan = round(plan * rng.uniform(0.18, 0.22))
                profit_actual = round(actual * rng.uniform(0.16, 0.22))
                order_plan = round(plan * rng.uniform(1.10, 1.20))
                order_actual = round(actual * rng.uniform(1.08, 1.18))
                rows.append({
                    "エリア": area,
                    "年度": year,
                    "四半期": quarter,
                    "売上_計画": plan,
                    "売上_実績": actual,
                    "利益_計画": profit_plan,
                    "利益_実績": profit_actual,
                    "受注_計画": order_plan,
                    "受注_実績": order_actual,
                })
    return pd.DataFrame(rows)


def generate_product_sales(area_pl: pd.DataFrame) -> pd.DataFrame:
    # Distribute area revenue across products using fixed weights + per-row noise
    product_weights = {"戸建": 0.45, "マンション": 0.35, "リフォーム": 0.20}
    rows = []
    for _, row in area_pl.iterrows():
        for product, weight in product_weights.items():
            w = weight * rng.uniform(0.92, 1.08)
            rows.append({
                "商品カテゴリ": product,
                "エリア": row["エリア"],
                "年度": row["年度"],
                "四半期": row["四半期"],
                "売上_計画": round(row["売上_計画"] * w),
                "売上_実績": round(row["売上_実績"] * w),
            })
    return pd.DataFrame(rows)


def main():
    output_dir = Path("data/raw")
    output_dir.mkdir(parents=True, exist_ok=True)

    area_pl = generate_area_pl()
    area_pl.to_excel(output_dir / "エリア収支.xlsx", index=False)
    print(f"Generated {output_dir / 'エリア収支.xlsx'} ({len(area_pl)} rows)")

    product_sales = generate_product_sales(area_pl)
    product_sales.to_excel(output_dir / "商品別売上.xlsx", index=False)
    print(f"Generated {output_dir / '商品別売上.xlsx'} ({len(product_sales)} rows)")


if __name__ == "__main__":
    main()
