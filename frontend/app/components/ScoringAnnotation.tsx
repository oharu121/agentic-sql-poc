"use client";

import type { Scoring } from "@/lib/types";

interface ScoringAnnotationProps {
  scoring: Scoring;
}

export function ScoringAnnotation({ scoring }: ScoringAnnotationProps) {
  const { is_correct, method, found_terms, missing_terms, prohibited_found, explanation } = scoring;

  const expectedHint =
    missing_terms.length > 0 ? missing_terms.slice(0, 3).join("」「") : null;

  return (
    <div
      className={`mt-1 p-3 rounded-xl border ${
        is_correct
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-red-500/10 border-red-500/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {is_correct ? (
          <>
            <span className="text-base">✅</span>
            <span className="text-sm font-medium text-emerald-300">正解</span>
            {method === "result_match" ? (
              <span className="badge badge-success text-[10px]">結果一致</span>
            ) : (
              <span className="badge badge-info text-[10px]">期待値一致</span>
            )}
          </>
        ) : (
          <>
            <span className="text-base">❌</span>
            <span className="text-sm font-medium text-red-300">不正解</span>
          </>
        )}
      </div>
      <p
        className={`mt-1 text-xs ${
          is_correct ? "text-emerald-200/80" : "text-red-200/80"
        }`}
      >
        {explanation}
      </p>
      {is_correct && found_terms.length > 0 && (
        <p className="mt-1 text-[11px] text-white/40">
          検出: {found_terms.join(", ")}
        </p>
      )}
      {!is_correct && expectedHint && (
        <p className="mt-1 text-[11px] text-white/40">
          期待: 「{expectedHint}」など
        </p>
      )}
      {!is_correct && prohibited_found.length > 0 && (
        <p className="mt-1 text-[11px] text-red-300/70">
          誤検出: {prohibited_found.join(", ")}
        </p>
      )}
    </div>
  );
}
