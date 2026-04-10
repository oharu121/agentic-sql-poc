"use client";

import { useState } from "react";
import { MayaAvatar } from "@/app/components/MayaAvatar";
import type { AvatarState } from "@/app/components/MayaAvatar";
import { ThinkingPanel } from "@/app/components/sql/ThinkingPanel";
import { SQLResultTable } from "@/app/components/sql/SQLResultTable";
import type { QueryRecord } from "@/lib/types";

interface QueryCardProps {
  record: QueryRecord;
}

export function QueryCard({ record }: QueryCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isDone = record.status === "done" || record.status === "error";
  const avatarState: AvatarState =
    record.status !== "streaming" ? "idling"
    : record.sqlResult ? "speaking"
    : "thinking";

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* User question bubble */}
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-linear-to-r from-blue-600 to-blue-700 text-white text-sm shadow-lg shadow-blue-500/20">
          {record.question}
        </div>
      </div>

      {/* Agent response area */}
      <div className="flex gap-3">
        <MayaAvatar state={avatarState} size={36} />

        <div className="flex-1 space-y-3 min-w-0">
          {/* Collapse toggle (only for completed queries) */}
          {isDone && (
            <button
              className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
              onClick={() => setCollapsed(!collapsed)}
            >
              <svg
                className={`w-3 h-3 transition-transform ${collapsed ? "" : "rotate-180"}`}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
              {collapsed ? "Show details" : "Collapse"}
            </button>
          )}

          {!collapsed && (
            <>
              <ThinkingPanel
                steps={record.thinkingSteps}
                isStreaming={record.status === "streaming"}
              />
              <SQLResultTable
                sql={record.generatedSQL}
                result={record.sqlResult}
                retries={record.retries}
                errorMessage={record.errorMessage}
              />
            </>
          )}

          {/* Collapsed summary */}
          {collapsed && isDone && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              {record.status === "done" ? (
                <>
                  <span className="badge badge-success">Done</span>
                  <span>{record.thinkingSteps.length} steps</span>
                  {record.retries.length > 0 && (
                    <span className="badge badge-warning">{record.retries.length} retries</span>
                  )}
                  {record.sqlResult && (
                    <span>{record.sqlResult.row_count} rows</span>
                  )}
                </>
              ) : (
                <span className="badge badge-error">Error</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
