"use client";

import { useEffect, useReducer, useState } from "react";
import { fetchExcelPreview } from "@/lib/api";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";

const TABLES = ["area_pl", "product_sales"] as const;
type TableName = (typeof TABLES)[number];

const TABLE_LABELS: Record<TableName, string> = {
  area_pl: "エリア収支 (Area P&L)",
  product_sales: "商品別売上 (Product Sales)",
};

interface PreviewData {
  columns: string[];
  rows: unknown[][];
  source_file: string;
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: PreviewData }
  | { status: "error"; message: string };

type FetchAction =
  | { type: "loading" }
  | { type: "success"; payload: PreviewData }
  | { type: "error"; message: string };

function fetchReducer(_: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "loading":
      return { status: "loading" };
    case "success":
      return { status: "success", data: action.payload };
    case "error":
      return { status: "error", message: action.message };
  }
}

// ── Excel-like grid ───────────────────────────────────────────────────────────

function colLetter(index: number): string {
  let n = index;
  let result = "";
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function ExcelGrid({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  // Insert the column-name row as the first data row, mimicking how Excel
  // shows column headers as actual cell content in row 1.
  const allRows: unknown[][] = [columns, ...rows];

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 max-h-96 bg-[#1e1e2e]">
      <table className="text-xs font-mono border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            {/* Top-left empty corner */}
            <th className="sticky left-0 z-20 bg-[#2d2d3f] border-r border-b border-white/15 w-10 min-w-10" />
            {columns.map((_, ci) => (
              <th
                key={ci}
                className="bg-[#2d2d3f] text-white/60 font-medium text-center px-3 py-1 border-r border-b border-white/15 min-w-32"
              >
                {colLetter(ci)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRows.map((row, ri) => (
            <tr key={ri}>
              {/* Row number cell */}
              <td className="sticky left-0 bg-[#2d2d3f] text-white/60 text-center px-2 py-1 border-r border-b border-white/15 font-medium">
                {ri + 1}
              </td>
              {(row as unknown[]).map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-1 border-r border-b border-white/10 whitespace-nowrap ${
                    ri === 0
                      ? "text-white/85 font-semibold bg-white/5"
                      : "text-white/70"
                  }`}
                >
                  {cell === null || cell === undefined ? (
                    <span className="text-white/20">NULL</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepExcelPreview() {
  const [activeTable, setActiveTable] = useState<TableName>("area_pl");
  const [state, dispatch] = useReducer(fetchReducer, { status: "idle" });

  useEffect(() => {
    dispatch({ type: "loading" });
    fetchExcelPreview(activeTable)
      .then((res) =>
        dispatch({
          type: "success",
          payload: {
            columns: res.columns,
            rows: res.rows,
            source_file: res.source_file,
          },
        })
      )
      .catch(() =>
        dispatch({ type: "error", message: "Excelプレビューの読み込みに失敗しました。" })
      );
  }, [activeTable]);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold gradient-text mb-2">ソースデータ</h2>
        <p className="text-white/50 text-sm">
          これらは、クエリ可能なデータベースに変換される元のExcelファイルです。
        </p>
      </div>

      {/* Source file name */}
      {state.status === "success" && (
        <p className="text-xs text-white/30 text-center mb-3 font-mono">
          ファイル: {state.data.source_file}
        </p>
      )}

      {/* Workbook (grid + sheet tabs) */}
      <div className="glass-bubble rounded-2xl p-4">
        {state.status === "loading" && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-400/60 text-center py-8">
            {state.message}
          </p>
        )}

        {state.status === "success" && (
          <ExcelGrid columns={state.data.columns} rows={state.data.rows} />
        )}

        {/* Sheet tabs (bottom-left, Excel-style) */}
        <SheetTabs activeTable={activeTable} onSelect={setActiveTable} />
      </div>
    </div>
  );
}

// ── Sheet tabs (Excel bottom-left style) ──────────────────────────────────────

function SheetTabs({
  activeTable,
  onSelect,
}: {
  activeTable: TableName;
  onSelect: (t: TableName) => void;
}) {
  return (
    <div className="flex items-end gap-0.5 mt-2 border-t border-white/10 pt-2 px-1">
      {TABLES.map((t) => {
        const isActive = activeTable === t;
        return (
          <button
            key={t}
            onClick={() => onSelect(t)}
            className={`text-xs font-mono px-3 py-1.5 rounded-t-md border-t border-x transition-all whitespace-nowrap ${
              isActive
                ? "bg-[#1e1e2e] text-white/90 border-white/15 -mb-px relative z-10"
                : "bg-[#2d2d3f]/60 text-white/40 hover:text-white/70 hover:bg-[#2d2d3f] border-white/10"
            }`}
          >
            {TABLE_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}
