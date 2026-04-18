"use client";

import { useEffect, useState } from "react";
import { useWizardStore } from "@/stores/wizardStore";
import { DataReferencePanel } from "@/app/components/data/DataReferencePanel";

export function DataReferenceDrawer() {
  const { drawerOpen, toggleDrawer } = useWizardStore();
  const [closing, setClosing] = useState(false);

  // Handle close with animation
  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      toggleDrawer();
      setClosing(false);
    }, 280);
  };

  // Close on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          closing ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        className={`relative w-full max-w-2xl h-full flex flex-col bg-[#0a0a0f]/95 backdrop-blur-xl border-l border-white/10 ${
          closing ? "animate-slide-out-right" : "animate-slide-in-right"
        }`}
        style={closing ? { animation: "slideOutRight 0.3s ease-out forwards" } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h3 className="text-lg font-semibold gradient-text">Data Reference</h3>
          <button
            onClick={handleClose}
            className="text-white/40 hover:text-white/80 transition-colors p-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DataReferencePanel />
        </div>
      </div>
    </div>
  );
}
