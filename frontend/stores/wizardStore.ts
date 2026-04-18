/**
 * Wizard state store — no persistence (resets every visit).
 * Tracks the current onboarding step and the data reference drawer.
 */

import { create } from "zustand";

interface WizardState {
  currentStep: number; // 1-4 = wizard, 5 = done (show chat)
  etlCompleted: boolean;
  drawerOpen: boolean;

  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  setEtlCompleted: (v: boolean) => void;
  toggleDrawer: () => void;
  completeWizard: () => void;
}

export const useWizardStore = create<WizardState>()((set) => ({
  currentStep: 1,
  etlCompleted: false,
  drawerOpen: false,

  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 5) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) })),
  goToStep: (step) => set({ currentStep: step }),
  setEtlCompleted: (v) => set({ etlCompleted: v }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  completeWizard: () => set({ currentStep: 5 }),
}));
