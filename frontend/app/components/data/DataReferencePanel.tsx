"use client";

import { useEffect, useReducer, useState } from "react";
import { fetchSchema, fetchParquetPreview } from "@/lib/api";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";
import type { TableSchema } from "@/lib/types";

const TABLES = ["area_pl", "product_sales"] as const;
type TableName = (typeof TABLES)[number];

// ── Column type badge ────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const color =
    type === "VARCHAR"
      ? "text-purple-300 bg-purple-500/10"
      : "text-amber-300 bg-amber-500/10";
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${color}`}
    >
      {type}
    </span>
  );
}

// ── Preview data table ───────────────────────────────────────────────────────

function PreviewTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: unknown[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 max-h-64">
      <table className="text-xs font-mono w-full">
        <thead className="sticky top-0 bg-black/60">
          <tr>
            {columns.map((col) => (
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
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/5 hover:bg-white/5">
              {(row as unknown[]).map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-white/60 whitespace-nowrap">
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

// ── Single table section ─────────────────────────────────────────────────────

function TableSection({
  schema,
  previewData,
}: {
  schema: TableSchema;
  previewData: { columns: string[]; rows: unknown[][] } | null;
}) {
  return (
    <div className="space-y-4">
      {/* Schema: columns + types */}
      <div>
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
          Columns
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1">
          {schema.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center justify-between gap-2 py-1"
            >
              <span className="text-sm font-mono text-white/70 truncate">
                {col.name}
              </span>
              <TypeBadge type={col.type} />
            </div>
          ))}
        </div>
      </div>

      {/* Enum values */}
      {Object.keys(schema.enum_values).length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
            Categorical Values
          </h4>
          <div className="space-y-2">
            {Object.entries(schema.enum_values).map(([col, values]) => (
              <div key={col}>
                <p className="text-xs text-white/50 mb-1 font-mono">{col}</p>
                <div className="flex flex-wrap gap-1">
                  {values.map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 rounded text-xs font-mono bg-white/5 text-white/60 border border-white/10"
                    >
                      {String(v)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample data */}
      {previewData && previewData.rows.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
            Sample Data ({previewData.rows.length} rows)
          </h4>
          <PreviewTable columns={previewData.columns} rows={previewData.rows} />
        </div>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

type DataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      schemas: TableSchema[];
      previews: Record<string, { columns: string[]; rows: unknown[][] }>;
    };

type DataAction =
  | { type: "loading" }
  | { type: "error"; message: string }
  | {
      type: "success";
      schemas: TableSchema[];
      previews: Record<string, { columns: string[]; rows: unknown[][] }>;
    };

function dataReducer(_: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "loading":
      return { status: "loading" };
    case "error":
      return { status: "error", message: action.message };
    case "success":
      return { status: "success", schemas: action.schemas, previews: action.previews };
  }
}

export function DataReferencePanel() {
  const [activeTable, setActiveTable] = useState<TableName>("area_pl");
  const [state, dispatch] = useReducer(dataReducer, { status: "loading" });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchSchema(),
      ...TABLES.map((t) =>
        fetchParquetPreview(t).catch(() => null)
      ),
    ])
      .then(([schemaRes, ...previewResults]) => {
        if (cancelled) return;
        const map: Record<string, { columns: string[]; rows: unknown[][] }> = {};
        TABLES.forEach((t, i) => {
          const result = previewResults[i];
          if (result) {
            map[t] = { columns: result.columns, rows: result.rows };
          }
        });
        dispatch({ type: "success", schemas: schemaRes.tables, previews: map });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "error", message: "Failed to load data reference" });
      });

    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-red-400/60">{state.message}</p>
      </div>
    );
  }

  const activeSchema = state.schemas.find((s) => s.name === activeTable);

  return (
    <div className="space-y-4">
      {/* Table tabs */}
      <div className="flex gap-2">
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
            {t}
          </button>
        ))}
      </div>

      {/* Active table content */}
      {activeSchema && (
        <TableSection
          schema={activeSchema}
          previewData={state.previews[activeTable] ?? null}
        />
      )}
    </div>
  );
}
