import pandas as pd
import pytest
from pathlib import Path
from etl.excel_to_parquet import validate_columns, validate_types, convert_excel_to_parquet
from sql.schema import AREA_PL_COLUMNS, PRODUCT_SALES_COLUMNS


def make_valid_area_pl_df():
    return pd.DataFrame({
        "エリア": ["関東"],
        "年度": [2024],
        "四半期": ["Q1"],
        "売上_計画": [500],
        "売上_実績": [480],
        "利益_計画": [90],
        "利益_実績": [85],
        "受注_計画": [580],
        "受注_実績": [560],
    })


class TestValidateColumns:
    def test_valid_df_passes(self):
        df = make_valid_area_pl_df()
        validate_columns(df, list(AREA_PL_COLUMNS.keys()), "test.xlsx")  # no exception

    def test_missing_column_raises_value_error(self):
        df = make_valid_area_pl_df().drop(columns=["売上_計画"])
        with pytest.raises(ValueError, match="missing columns"):
            validate_columns(df, list(AREA_PL_COLUMNS.keys()), "test.xlsx")

    def test_error_message_names_missing_column(self):
        df = make_valid_area_pl_df().drop(columns=["利益_実績", "受注_実績"])
        with pytest.raises(ValueError) as exc_info:
            validate_columns(df, list(AREA_PL_COLUMNS.keys()), "test.xlsx")
        assert "利益_実績" in str(exc_info.value) or "受注_実績" in str(exc_info.value)


class TestValidateTypes:
    def test_valid_types_pass(self):
        df = make_valid_area_pl_df()
        validate_types(df, AREA_PL_COLUMNS, "test.xlsx")  # no exception

    def test_non_numeric_integer_column_raises_type_error(self):
        df = make_valid_area_pl_df()
        df["売上_計画"] = ["abc"]  # string instead of int
        with pytest.raises(TypeError, match="売上_計画"):
            validate_types(df, AREA_PL_COLUMNS, "test.xlsx")


class TestConvertExcelToParquet:
    def test_produces_parquet_with_correct_shape(self, tmp_path):
        # Write a valid Excel file
        df = pd.concat([make_valid_area_pl_df()] * 3, ignore_index=True)
        excel_path = tmp_path / "test.xlsx"
        df.to_excel(excel_path, index=False)
        out_path = tmp_path / "out.parquet"

        convert_excel_to_parquet(excel_path, out_path, list(AREA_PL_COLUMNS.keys()), AREA_PL_COLUMNS)

        result = pd.read_parquet(out_path)
        assert result.shape == (3, len(AREA_PL_COLUMNS))
        assert list(result.columns) == list(AREA_PL_COLUMNS.keys())

    def test_integer_columns_are_cast(self, tmp_path):
        df = make_valid_area_pl_df()
        df["売上_計画"] = df["売上_計画"].astype(float)  # Excel often exports as float
        excel_path = tmp_path / "test.xlsx"
        df.to_excel(excel_path, index=False)
        out_path = tmp_path / "out.parquet"

        convert_excel_to_parquet(excel_path, out_path, list(AREA_PL_COLUMNS.keys()), AREA_PL_COLUMNS)

        result = pd.read_parquet(out_path)
        assert result["売上_計画"].dtype in [pd.Int64Dtype(), "int64", "int32"]

    def test_missing_column_raises_before_writing(self, tmp_path):
        df = make_valid_area_pl_df().drop(columns=["エリア"])
        excel_path = tmp_path / "test.xlsx"
        df.to_excel(excel_path, index=False)
        out_path = tmp_path / "out.parquet"

        with pytest.raises(ValueError, match="missing columns"):
            convert_excel_to_parquet(excel_path, out_path, list(AREA_PL_COLUMNS.keys()), AREA_PL_COLUMNS)

        assert not out_path.exists()  # file must NOT be created on validation failure
