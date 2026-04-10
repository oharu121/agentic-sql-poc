"use client";

import { useEffect, useState } from "react";
import { fetchSchema } from "@/lib/api";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";
import type { TableSchema } from "@/lib/types";

// ── Column type badge ─────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const color = type === "VARCHAR" ? "text-purple-300 bg-purple-500/10" : "text-amber-300 bg-amber-500/10";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${color}`}>
      {type}
    </span>
  );
}

// ── Single table accordion ────────────────────────────────────────────────────

function TableAccordion({ table }: { table: TableSchema }) {
  const [open, setOpen] = useState(true);
  const [showSample, setShowSample] = useState(false);

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden mb-2">
      {/* Table header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125c0-.621.504-1.125 1.125-1.125m0 0h17.25m0 0c.621 0 1.125.504 1.125 1.125M6 18.375V5.625m0 12.75h12M6 5.625A1.125 1.125 0 017.125 4.5h9.75A1.125 1.125 0 0118 5.625m0 0v12.75M18 18.375V5.625" />
          </svg>
          <span className="text-sm font-medium text-white/80 font-mono">{table.name}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Columns */}
          <div className="space-y-1">
            {table.columns.map((col) => (
              <div key={col.name} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-xs font-mono text-white/70">{col.name}</span>
                <TypeBadge type={col.type} />
              </div>
            ))}
          </div>

          {/* Enum values */}
          {Object.entries(table.enum_values).map(([col, values]) => (
            <div key={col}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{col}</p>
              <div className="flex flex-wrap gap-1">
                {values.map((v) => (
                  <span
                    key={v}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-white/60 border border-white/10"
                  >
                    {String(v)}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Sample rows toggle */}
          {table.sample_rows.length > 0 && (
            <div>
              <button
                className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                onClick={() => setShowSample(!showSample)}
              >
                {showSample ? "Hide sample rows" : `Show ${table.sample_rows.length} sample rows`}
              </button>
              {showSample && (
                <div className="mt-1.5 overflow-x-auto rounded-lg border border-white/10">
                  <table className="text-[10px] font-mono w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        {table.columns.map((c) => (
                          <th key={c.name} className="px-2 py-1 text-white/40 text-left whitespace-nowrap">
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.sample_rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-white/5">
                          {(row as unknown[]).map((cell, ci) => (
                            <td key={ci} className="px-2 py-1 text-white/60 whitespace-nowrap">
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function SchemaSidebar() {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchema()
      .then((res) => setTables(res.tables))
      .catch(() => setError("Failed to load schema"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-red-400/60 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-3 px-1">
        Tables ({tables.length})
      </p>
      {tables.map((table) => (
        <TableAccordion key={table.name} table={table} />
      ))}
    </div>
  );
}
