"use client";

import { MayaAvatar } from "@/app/components/MayaAvatar";
import { UI_TEXT } from "@/lib/constants";
import type { EvaluationScore } from "@/lib/types";

interface EvaluationSummaryBubbleProps {
  score: EvaluationScore;
}

const CATEGORY_LABEL: Record<string, string> = {
  general: "一般 (general)",
  exception: "応用 (exception)",
};

export function EvaluationSummaryBubble({ score }: EvaluationSummaryBubbleProps) {
  const isPerfect = score.percentage === 100;
  const isGood = score.percentage >= 75;
  const filled = Math.round((score.correct / Math.max(score.total, 1)) * 10);

  return (
    <div className="flex gap-3 animate-fade-in-up">
      <MayaAvatar state="speaking" size={36} />
      <div className="flex-1 glass-bubble rounded-2xl border border-white/10 p-5 max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📊</span>
          <span className="font-semibold text-white/90">{UI_TEXT.evalSummaryTitle}</span>
          {isPerfect && <span>🎉</span>}
        </div>

        <div className="flex items-center gap-4 mb-4">
          <span
            className={`text-3xl font-bold ${
              isGood ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {score.percentage}%
          </span>
          <span className="text-white/60 text-sm">
            ({score.correct}/{score.total} 正解)
          </span>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-5 rounded-sm ${
                  i < filled
                    ? isGood
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-white/50 mb-1">
            カテゴリ別成績
          </div>
          {Object.entries(score.by_category).map(([cat, stats]) => {
            const isPassing = stats.correct === stats.total;
            const isFailing = stats.correct === 0;
            const label = CATEGORY_LABEL[cat] ?? cat;
            return (
              <div key={cat} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-center">
                  {isPassing ? "✅" : isFailing ? "❌" : "⚠️"}
                </span>
                <span className="text-white/70 min-w-[6.5rem]">{label}</span>
                <span className="text-white/50 text-xs min-w-[3rem]">
                  {stats.correct}/{stats.total}
                </span>
                <div className="flex gap-0.5">
                  {Array.from({ length: stats.total }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-3 rounded-sm ${
                        i < stats.correct
                          ? isPassing
                            ? "bg-emerald-400"
                            : "bg-amber-400"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
