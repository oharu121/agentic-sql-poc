"use client";

import { useWizardStore } from "@/stores/wizardStore";

export function WizardNavigation() {
  const { currentStep, etlCompleted, prevStep, nextStep, completeWizard } =
    useWizardStore();

  const isFirst = currentStep === 1;
  const isLast = currentStep === 4;
  // Disable Next on step 2 until ETL completes
  const nextDisabled = currentStep === 2 && !etlCompleted;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 glass-header">
      <button
        onClick={prevStep}
        disabled={isFirst}
        className={`text-sm px-5 py-2.5 rounded-lg transition-all ${
          isFirst
            ? "text-white/20 cursor-not-allowed"
            : "text-white/60 hover:text-white/80 hover:bg-white/5"
        }`}
      >
        Back
      </button>

      <span className="text-xs text-white/30">
        Step {currentStep} of 4
      </span>

      <button
        onClick={isLast ? completeWizard : nextStep}
        disabled={nextDisabled}
        className={`btn-primary text-sm px-5 py-2.5 rounded-lg ${
          nextDisabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {isLast ? "Start Querying" : "Next"}
      </button>
    </div>
  );
}
