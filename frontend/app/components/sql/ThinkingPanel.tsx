"use client";

import { useState } from "react";
import type { ThinkingStep } from "@/lib/types";

// ── Step icons (inline SVG, no dependency) ────────────────────────────────────

function IconDocument() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}


function IconCheck() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

// ── Step config ───────────────────────────────────────────────────────────────

const STEP_ICON: Record<string, React.ReactNode> = {
  prompt_build: <IconDocument />,
  llm_call: <IconSparkle />,
  sql_extract: <IconCode />,
  sql_execute: <IconPlay />,
  sql_retry: <IconRefresh />,
  sql_done: <IconCheck />,
};

function getIcon(step: string) {
  return STEP_ICON[step] ?? <IconSparkle />;
}

function StatusDot({ status }: { status: string }) {
  if (status === "running") {
    return <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />;
  }
  if (status === "done") {
    return <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />;
  }
  if (status === "error") {
    return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />;
  }
  return <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />;
}

// ── Main component ────────────────────────────────────────────────────────────

interface ThinkingPanelProps {
  steps: ThinkingStep[];
  isStreaming: boolean;
}

export function ThinkingPanel({ steps, isStreaming }: ThinkingPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (steps.length === 0 && !isStreaming) return null;

  return (
    <div className="glass-bubble rounded-xl border border-white/10 p-3 space-y-1 animate-fade-in-up">
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Pipeline steps</p>

      {steps.map((step, i) => (
        <div key={i} className="animate-fade-in">
          <button
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
            onClick={() => step.detail ? setExpandedIndex(expandedIndex === i ? null : i) : undefined}
            disabled={!step.detail}
          >
            {/* Icon */}
            <span className={`shrink-0 ${
              step.status === "running" ? "text-blue-400" :
              step.status === "done" ? "text-green-400" :
              step.status === "error" ? "text-red-400" :
              "text-gray-500"
            }`}>
              {getIcon(step.step)}
            </span>

            {/* Label */}
            <span className={`flex-1 text-sm ${
              step.status === "running" ? "text-white" :
              step.status === "done" ? "text-white/70" :
              step.status === "error" ? "text-red-300" :
              "text-white/50"
            }`}>
              {step.label}
            </span>

            {/* Elapsed time */}
            {step.elapsed_ms !== undefined && (
              <span className="text-xs text-white/30 font-mono shrink-0">
                {step.elapsed_ms < 1000
                  ? `${step.elapsed_ms}ms`
                  : `${(step.elapsed_ms / 1000).toFixed(1)}s`}
              </span>
            )}

            {/* Status dot */}
            <StatusDot status={step.status} />

            {/* Expand indicator */}
            {step.detail && (
              <svg
                className={`w-3 h-3 text-white/30 shrink-0 transition-transform ${expandedIndex === i ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            )}
          </button>

          {/* Collapsible detail */}
          {expandedIndex === i && step.detail && (
            <div className="ml-7 mt-1 mb-1 px-3 py-2 bg-black/30 rounded-lg border border-white/5">
              <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap break-all">
                {step.detail}
              </pre>
            </div>
          )}
        </div>
      ))}

      {isStreaming && steps.length === 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-white/50 text-sm">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Starting pipeline…
        </div>
      )}
    </div>
  );
}
