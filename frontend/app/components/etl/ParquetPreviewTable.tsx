"use client";

import { useEffect, useReducer, useState } from "react";
import { fetchParquetPreview } from "@/lib/api";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";

const TABLES = ["area_pl", "product_sales"] as const;
type TableName = (typeof TABLES)[number];

interface PreviewData {
  columns: string[];
  rows: unknown[][];
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
    case "loading": return { status: "loading" };
    case "success": return { status: "success", data: action.payload };
    case "error": return { status: "error", message: action.message };
  }
}

export function ParquetPreviewTable() {
  const [activeTable, setActiveTable] = useState<TableName>("area_pl");
  const [state, dispatch] = useReducer(fetchReducer, { status: "idle" });

  useEffect(() => {
    dispatch({ type: "loading" });
    fetchParquetPreview(activeTable)
      .then((res) => dispatch({ type: "success", payload: { columns: res.columns, rows: res.rows } }))
      .catch(() => dispatch({ type: "error", message: "Run ETL to generate Parquet files first." }));
  }, [activeTable]);

  return (
    <div className="space-y-2">
      {/* Tab selector */}
      <div className="flex gap-1">
        {TABLES.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTable(t)}
            className={`text-[10px] font-mono px-2.5 py-1 rounded-lg transition-all ${
              activeTable === t
                ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {state.status === "loading" && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {state.status === "error" && (
        <p className="text-[10px] text-yellow-400/60 text-center py-2">{state.message}</p>
      )}

      {state.status === "success" && (
        <div className="overflow-x-auto rounded-lg border border-white/10 max-h-48">
          <table className="text-[10px] font-mono w-full">
            <thead className="sticky top-0 bg-black/60">
              <tr>
                {state.data.columns.map((col) => (
                  <th key={col} className="px-2 py-1.5 text-left text-white/50 whitespace-nowrap border-b border-white/10">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.data.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/3">
                  {(row as unknown[]).map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 text-white/60 whitespace-nowrap">
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
  );
}
