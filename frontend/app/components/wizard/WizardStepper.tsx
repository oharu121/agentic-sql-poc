"use client";

import { useWizardStore } from "@/stores/wizardStore";

const STEPS = [
  { label: "データ確認", icon: "📊" },
  { label: "検証と変換", icon: "✓" },
  { label: "スキーマ", icon: "📋" },
  { label: "クエリ開始", icon: "💬" },
];

export function WizardStepper() {
  const currentStep = useWizardStore((s) => s.currentStep);

  return (
    <div className="flex items-center justify-center gap-2 py-4 px-6">
      {STEPS.map((step, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-px ${
                  isCompleted ? "bg-green-400/60" : "bg-white/10"
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-500/20 text-blue-300 ring-2 ring-blue-400/50"
                    : isCompleted
                      ? "bg-green-500/20 text-green-300 ring-1 ring-green-400/30"
                      : "bg-white/5 text-white/30 ring-1 ring-white/10"
                }`}
              >
                {isCompleted ? "✓" : step.icon}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap hidden sm:block ${
                  isActive
                    ? "text-white/80"
                    : isCompleted
                      ? "text-green-300/60"
                      : "text-white/30"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
