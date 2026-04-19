"use client";

import { useWizardStore } from "@/stores/wizardStore";

const EXAMPLE_QUESTIONS = [
  "関東エリアの今期（2025年度）累計売上実績は？",
  "2025年度で利益の計画達成率が最も高いエリアはどこですか？",
  "2025年度Q2の商品別売上ランキングを教えてください。",
];

export function StepStartQuerying() {
  const completeWizard = useWizardStore((s) => s.completeWizard);

  return (
    <div className="max-w-lg mx-auto text-center animate-fade-in-up">
      <div className="mb-8">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold gradient-text mb-2">
          準備完了！
        </h2>
        <p className="text-white/50 text-sm">
          データの処理が完了し、DuckDBに読み込まれました。日本語で質問すると、
          AIエージェントがSQLを生成・実行し、結果を表示します。
        </p>
      </div>

      <div className="space-y-3 mb-8">
        <p className="text-xs text-white/40 uppercase tracking-wider">
          質問例
        </p>
        {EXAMPLE_QUESTIONS.map((q) => (
          <div
            key={q}
            className="text-sm text-left px-4 py-3 rounded-xl glass-bubble text-white/60"
          >
            {q}
          </div>
        ))}
      </div>

      <button
        onClick={completeWizard}
        className="btn-primary text-base px-8 py-3 rounded-xl"
      >
        クエリ開始
      </button>
    </div>
  );
}
