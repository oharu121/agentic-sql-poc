"use client";

import { useEffect } from "react";
import { checkHealth } from "@/lib/api";
import { UI_TEXT } from "@/lib/constants";
import { useWizardStore } from "@/stores/wizardStore";
import { QueryInterface } from "@/app/components/QueryInterface";
import { DataReferenceDrawer } from "@/app/components/DataReferenceDrawer";
import { WizardStepper } from "@/app/components/wizard/WizardStepper";
import { WizardNavigation } from "@/app/components/wizard/WizardNavigation";
import { StepExcelPreview } from "@/app/components/wizard/StepExcelPreview";
import { StepValidateTransform } from "@/app/components/wizard/StepValidateTransform";
import { StepSchemaOverview } from "@/app/components/wizard/StepSchemaOverview";
import { StepStartQuerying } from "@/app/components/wizard/StepStartQuerying";

function WizardStepContent({ step }: { step: number }) {
  switch (step) {
    case 1:
      return <StepExcelPreview />;
    case 2:
      return <StepValidateTransform />;
    case 3:
      return <StepSchemaOverview />;
    case 4:
      return <StepStartQuerying />;
    default:
      return null;
  }
}

export default function Home() {
  const currentStep = useWizardStore((s) => s.currentStep);
  const wizardDone = currentStep >= 5;

  // Wake backend from cold start on page load
  useEffect(() => {
    checkHealth().catch(() => {});
  }, []);

  // Wizard mode
  if (!wizardDone) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="glass-header border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between px-6 py-3">
            <div>
              <h1 className="text-base font-semibold gradient-text">
                {UI_TEXT.appTitle}
              </h1>
              <p className="text-[10px] text-white/40 mt-0.5">
                {UI_TEXT.appSubtitle}
              </p>
            </div>
          </div>
          <WizardStepper />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <WizardStepContent step={currentStep} />
        </div>

        {/* Navigation */}
        <WizardNavigation />
      </div>
    );
  }

  // Chat mode
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <main className="flex-1 overflow-hidden">
        <QueryInterface />
      </main>
      <DataReferenceDrawer />
    </div>
  );
}
