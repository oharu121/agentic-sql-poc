"use client";

import { useEffect, useRef } from "react";
import { QueryCard } from "@/app/components/QueryCard";
import { ChatInput } from "@/app/components/ChatInput";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";
import { useQuery } from "@/hooks/useQuery";
import { UI_TEXT } from "@/lib/constants";

export function QueryInterface() {
  const { records, isLoading, error, sendQuery, clearHistory, clearError } = useQuery();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [records]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="glass-header flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          {isLoading && <LoadingSpinner size="sm" />}
          <span className="text-sm text-white/60">
            {isLoading ? "Processing…" : `${records.length} ${records.length === 1 ? "query" : "queries"}`}
          </span>
        </div>
        {records.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            {UI_TEXT.clearButton}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2 glass-bubble rounded-xl border border-red-500/30 flex items-center justify-between gap-3">
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={clearError} className="text-red-400/60 hover:text-red-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Query history */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {records.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center glass-bubble rounded-2xl p-8 max-w-md">
              <h2 className="text-xl font-bold gradient-text mb-2">{UI_TEXT.welcomeMessage}</h2>
              <p className="text-white/50 text-sm">{UI_TEXT.welcomeDescription}</p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendQuery(q)}
                    disabled={isLoading}
                    className="text-xs text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-all border border-white/5 hover:border-white/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          records.map((record) => (
            <QueryCard key={record.id} record={record} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 glass-header">
        <ChatInput onSend={sendQuery} disabled={isLoading} />
      </div>
    </div>
  );
}

const EXAMPLE_QUESTIONS = [
  "関東エリアの今期（2025年度）累計売上実績は？",
  "2025年度で利益の計画達成率が最も高いエリアはどこですか？",
  "2025年度Q2の商品別売上ランキングを教えてください。",
];
