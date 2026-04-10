# sql/schema.py
# Single source of truth for table structure.
# ETL validation, DuckDB registration, and Claude system prompt all derive from here.

AREA_PL_TABLE = "area_pl"
AREA_PL_COLUMNS = {
    "エリア": "VARCHAR",
    "年度": "INTEGER",
    "四半期": "VARCHAR",
    "売上_計画": "INTEGER",
    "売上_実績": "INTEGER",
    "利益_計画": "INTEGER",
    "利益_実績": "INTEGER",
    "受注_計画": "INTEGER",
    "受注_実績": "INTEGER",
}

PRODUCT_SALES_TABLE = "product_sales"
PRODUCT_SALES_COLUMNS = {
    "商品カテゴリ": "VARCHAR",
    "エリア": "VARCHAR",
    "年度": "INTEGER",
    "四半期": "VARCHAR",
    "売上_計画": "INTEGER",
    "売上_実績": "INTEGER",
}

# Enumerated categorical values — included in Claude's system prompt for accuracy
AREA_VALUES = ["関東", "関西", "中部", "九州", "東北"]
QUARTER_VALUES = ["Q1", "Q2", "Q3", "Q4"]
PRODUCT_CATEGORY_VALUES = ["戸建", "マンション", "リフォーム"]
YEAR_VALUES = [2024, 2025]
