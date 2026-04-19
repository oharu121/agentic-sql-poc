"use client";

import { useCallback } from "react";
import { ETLPipelineView } from "@/app/components/etl/ETLPipelineView";
import { useWizardStore } from "@/stores/wizardStore";

export function StepValidateTransform() {
  const { etlCompleted, setEtlCompleted } = useWizardStore();

  const handleComplete = useCallback(() => {
    setEtlCompleted(true);
  }, [setEtlCompleted]);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold gradient-text mb-2">
          検証と変換
        </h2>
        <p className="text-white/50 text-sm">
          パイプラインは各Excelファイルを読み込み、列名とデータ型を検証して、
          クリーンなParquetファイルを出力します。最後に、DuckDBがParquetデータを
          読み込み、クエリ可能になります。
        </p>
      </div>

      <div className="glass-bubble rounded-2xl p-6">
        <ETLPipelineView onComplete={handleComplete} />
      </div>

      {etlCompleted && (
        <p className="text-center text-sm text-green-400/80 mt-4 animate-fade-in">
          パイプライン完了 — 「次へ」をクリックしてスキーマを確認してください。
        </p>
      )}
    </div>
  );
}
