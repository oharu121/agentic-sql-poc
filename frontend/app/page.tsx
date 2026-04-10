"use client";

import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import { UI_TEXT } from "@/lib/constants";
import { QueryInterface } from "@/app/components/QueryInterface";
import { SchemaSidebar } from "@/app/components/schema/SchemaSidebar";
import { ETLPipelineView } from "@/app/components/etl/ETLPipelineView";
import { ParquetPreviewTable } from "@/app/components/etl/ParquetPreviewTable";

export default function Home() {
  const [etlRefreshKey, setETLRefreshKey] = useState(0);

  // Wake HuggingFace Spaces from cold start on page load
  useEffect(() => {
    checkHealth().catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-white/10 glass-header overflow-hidden">
        {/* App header */}
        <div className="p-4 border-b border-white/10 shrink-0">
          <h1 className="text-base font-semibold gradient-text">{UI_TEXT.appTitle}</h1>
          <p className="text-[10px] text-white/40 mt-0.5">{UI_TEXT.appSubtitle}</p>
        </div>

        {/* Scrollable sidebar content */}
        <div className="flex-1 overflow-y-auto">
          {/* ETL pipeline section */}
          <div className="p-3 border-b border-white/10">
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-3">
              Data pipeline
            </p>
            <ETLPipelineView onComplete={() => setETLRefreshKey((k) => k + 1)} />
          </div>

          {/* Parquet preview */}
          <div className="p-3 border-b border-white/10">
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-3">
              Parquet preview
            </p>
            <ParquetPreviewTable key={etlRefreshKey} />
          </div>

          {/* Schema browser */}
          <div className="p-3">
            <SchemaSidebar key={etlRefreshKey} />
          </div>
        </div>
      </aside>

      {/* ── Main query area ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <QueryInterface />
      </main>
    </div>
  );
}
