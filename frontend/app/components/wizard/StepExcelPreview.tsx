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
        dispatch({ type: "error", message: "Failed to load Excel preview." })
      );
  }, [activeTable]);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold gradient-text mb-2">Source Data</h2>
        <p className="text-white/50 text-sm">
          These are the raw Excel files that will be processed into a queryable
          database.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 mb-4 justify-center">
        {TABLES.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTable(t)}
            className={`text-sm font-mono px-4 py-2 rounded-lg transition-all ${
              activeTable === t
                ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                : "text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent"
            }`}
          >
            {TABLE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Source file name */}
      {state.status === "success" && (
        <p className="text-xs text-white/30 text-center mb-3 font-mono">
          Source: {state.data.source_file}
        </p>
      )}

      {/* Content */}
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
          <div className="overflow-x-auto rounded-lg border border-white/10 max-h-96">
            <table className="text-xs font-mono w-full">
              <thead className="sticky top-0 bg-black/60">
                <tr>
                  {state.data.columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left text-white/50 whitespace-nowrap border-b border-white/10"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.data.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    {(row as unknown[]).map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 text-white/60 whitespace-nowrap"
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
        )}
      </div>
    </div>
  );
}
