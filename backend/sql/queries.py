# sql/queries.py
# Hand-written reference queries for the three business questions.
# These serve as ground truth to compare against agent-generated SQL.
# All monetary values are in 百万円 (million yen).

QUERIES: dict[str, str] = {
    "関東エリアの今期（2025年度）累計売上実績は？": """
        SELECT
            SUM("売上_実績") AS 累計売上実績_百万円
        FROM area_pl
        WHERE "エリア" = '関東'
          AND "年度" = 2025
    """,

    "全エリアで2025年度の計画比達成率が最も低いのはどこか？": """
        SELECT
            "エリア",
            SUM("売上_実績")                               AS 実績_百万円,
            SUM("売上_計画")                               AS 計画_百万円,
            ROUND(100.0 * SUM("売上_実績") / SUM("売上_計画"), 1) AS 達成率_percent
        FROM area_pl
        WHERE "年度" = 2025
        GROUP BY "エリア"
        ORDER BY 達成率_percent ASC
        LIMIT 1
    """,

    "2025年度Q2の商品別売上ランキングを教えてください。": """
        SELECT
            "商品カテゴリ",
            SUM("売上_実績") AS 売上実績_百万円
        FROM product_sales
        WHERE "年度" = 2025
          AND "四半期" = 'Q2'
        GROUP BY "商品カテゴリ"
        ORDER BY 売上実績_百万円 DESC
    """,
}
