"use client";

import { useState, useCallback } from "react";
import { streamETL } from "@/lib/api";
import type { ETLStepState } from "@/lib/types";

// ── Pipeline stage card ───────────────────────────────────────────────────────

const STAGES = [
  { key: "read", label: "Excel", icon: "📊" },
  { key: "validate_cols", label: "検証", icon: "✓" },
  { key: "write_parquet", label: "Parquet", icon: "📦" },
] as const;

type StageStatus = "idle" | "running" | "done" | "error";

interface StageCardProps {
  icon: string;
  label: string;
  status: StageStatus;
  isFirst?: boolean;
}

function StageCard({ icon, label, status, isFirst = false }: StageCardProps) {
  const ringColor =
    status === "running" ? "ring-2 ring-blue-400 animate-pulse-glow" :
    status === "done" ? "ring-2 ring-green-400" :
    status === "error" ? "ring-2 ring-red-400" :
    "ring-1 ring-white/10";

  return (
    <div className="flex items-center gap-2">
      {!isFirst && (
        <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      )}
      <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/5 transition-all ${ringColor}`}>
        <span className="text-base">{icon}</span>
        <span className="text-[10px] text-white/60 font-medium whitespace-nowrap">{label}</span>
        {status === "done" && <span className="text-[10px] text-green-400">✓</span>}
        {status === "running" && <span className="text-[10px] text-blue-400 animate-pulse">…</span>}
        {status === "error" && <span className="text-[10px] text-red-400">✗</span>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ETLPipelineViewProps {
  onComplete?: () => void;
}

export function ETLPipelineView({ onComplete }: ETLPipelineViewProps) {
  const [running, setRunning] = useState(false);
  const [stageStatus, setStageStatus] = useState<Record<string, StageStatus>>({});
  const [stepLog, setStepLog] = useState<ETLStepState[]>([]);
  const [done, setDone] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setDone(false);
    setHasError(false);
    setStageStatus({});
    setStepLog([]);

    try {
      for await (const event of streamETL()) {
        if (event.type === "etl_step") {
          const { step, status } = event.data;
          setStageStatus((prev) => ({ ...prev, [step]: status as StageStatus }));
          setStepLog((prev) => [...prev, event.data]);
          if (status === "error") setHasError(true);
        } else if (event.type === "done") {
          setDone(true);
          if (event.data.error) setHasError(true);
          else onComplete?.();
        }
      }
    } catch {
      setHasError(true);
    } finally {
      setRunning(false);
    }
  }, [onComplete]);

  return (
    <div className="space-y-3">
      {/* Pipeline flow */}
      <div className="flex items-center gap-1 flex-wrap">
        {STAGES.map((stage, i) => (
          <StageCard
            key={stage.key}
            icon={stage.icon}
            label={stage.label}
            status={stageStatus[stage.key] ?? "idle"}
            isFirst={i === 0}
          />
        ))}
        {/* Arrow + DuckDB */}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/5 transition-all ${
            done && !hasError ? "ring-2 ring-green-400" : "ring-1 ring-white/10"
          }`}>
            <span className="text-base">🦆</span>
            <span className="text-[10px] text-white/60 font-medium">DuckDB</span>
            {done && !hasError && <span className="text-[10px] text-green-400">✓</span>}
          </div>
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running}
        className={`btn-primary text-xs px-3 py-2 rounded-lg w-full ${running ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {running ? "ETL実行中…" : done ? "ETL再実行" : "ETL実行"}
      </button>

      {/* Status */}
      {done && !hasError && (
        <p className="text-xs text-green-400 text-center">ETL完了 — DuckDBにデータを読み込みました</p>
      )}
      {hasError && (
        <p className="text-xs text-red-400 text-center">ETL失敗 — 下記のログを確認してください</p>
      )}

      {/* Step log */}
      {stepLog.length > 0 && (
        <div className="space-y-0.5 max-h-32 overflow-y-auto">
          {stepLog.map((s, i) => (
            <div key={i} className={`text-[10px] flex gap-2 font-mono ${
              s.status === "error" ? "text-red-400" :
              s.status === "done" ? "text-green-400/70" :
              "text-white/40"
            }`}>
              <span className="shrink-0">{s.status === "running" ? "▶" : s.status === "done" ? "✓" : "✗"}</span>
              <span className="truncate">[{s.file}] {s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
