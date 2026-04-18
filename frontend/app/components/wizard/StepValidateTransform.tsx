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
          Validate & Transform
        </h2>
        <p className="text-white/50 text-sm">
          The pipeline reads each Excel file, validates column names and data
          types, then writes clean Parquet files. Finally, DuckDB loads the
          Parquet data for querying.
        </p>
      </div>

      <div className="glass-bubble rounded-2xl p-6">
        <ETLPipelineView onComplete={handleComplete} />
      </div>

      {etlCompleted && (
        <p className="text-center text-sm text-green-400/80 mt-4 animate-fade-in">
          Pipeline complete — click Next to see the schema.
        </p>
      )}
    </div>
  );
}
