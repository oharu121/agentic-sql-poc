"use client";

import { DataReferencePanel } from "@/app/components/data/DataReferencePanel";

export function StepSchemaOverview() {
  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold gradient-text mb-2">
          Your Database Schema
        </h2>
        <p className="text-white/50 text-sm">
          This is the data the AI agent can query. Review the tables, column
          types, and sample rows below.
        </p>
      </div>

      <div className="glass-bubble rounded-2xl p-6">
        <DataReferencePanel />
      </div>
    </div>
  );
}
