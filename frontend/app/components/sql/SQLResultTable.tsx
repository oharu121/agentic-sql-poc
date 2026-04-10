"use client";

import { useState } from "react";
import type { SQLResult, SQLRetry } from "@/lib/types";

interface SQLResultTableProps {
  sql?: string;
  result?: SQLResult;
  retries?: SQLRetry[];
  errorMessage?: string;
}

export function SQLResultTable({ sql, result, retries = [], errorMessage }: SQLResultTableProps) {
  const [sqlExpanded, setSQLExpanded] = useState(true);
  const [errorExpanded, setErrorExpanded] = useState(false);

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Generated SQL */}
      {sql && (
        <div className="glass-bubble rounded-xl border border-white/10 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
            onClick={() => setSQLExpanded(!sqlExpanded)}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="text-sm font-medium text-white/70">Generated SQL</span>
            </div>
            <svg
              className={`w-4 h-4 text-white/30 transition-transform ${sqlExpanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {sqlExpanded && (
            <div className="px-4 pb-3">
              <pre className="text-xs font-mono text-blue-300 bg-black/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                {sql}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Retry history */}
      {retries.length > 0 && (
        <div className="glass-bubble rounded-xl border border-yellow-500/20 p-3 space-y-1">
          <p className="text-xs font-medium text-yellow-400/70 uppercase tracking-wider mb-2">
            Self-correction ({retries.length} {retries.length === 1 ? "retry" : "retries"})
          </p>
          {retries.map((retry, i) => (
            <div key={i} className="text-xs text-white/50 flex gap-2">
              <span className="badge badge-warning shrink-0">Attempt {retry.attempt}</span>
              <span className="text-red-300/70 font-mono">{retry.error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {errorMessage && (
        <div className="glass-bubble rounded-xl border border-red-500/30 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="text-sm text-red-300 flex-1">{errorMessage}</span>
            {sql && (
              <button
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
                onClick={() => setErrorExpanded(!errorExpanded)}
              >
                {errorExpanded ? "hide SQL" : "show SQL"}
              </button>
            )}
          </div>
          {errorExpanded && sql && (
            <div className="px-4 pb-3">
              <pre className="text-xs font-mono text-red-300/60 bg-black/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {sql}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Results table */}
      {result && (
        <div className="glass-bubble rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125c0-.621.504-1.125 1.125-1.125m0 0h17.25m0 0c.621 0 1.125.504 1.125 1.125M6 18.375V5.625m0 12.75h12M6 5.625A1.125 1.125 0 017.125 4.5h9.75A1.125 1.125 0 0118 5.625m0 0v12.75M18 18.375V5.625" />
              </svg>
              <span className="text-sm font-medium text-white/70">Result</span>
            </div>
            <span className="badge badge-info text-xs">
              {result.row_count} {result.row_count === 1 ? "row" : "rows"}
            </span>
          </div>

          {result.row_count === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-white/40">
              Query returned no results.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-black/50">
                  <tr>
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2 text-left font-medium text-white/60 whitespace-nowrap border-b border-white/10"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors"
                    >
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-2 font-mono text-white/80 whitespace-nowrap">
                          {cell === null || cell === undefined ? (
                            <span className="text-white/30">NULL</span>
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
      )}
    </div>
  );
}
