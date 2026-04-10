"use client";

import { useState, useCallback, useRef } from "react";
import { streamQuery } from "@/lib/api";
import { UI_TEXT } from "@/lib/constants";
import { useQueryStore } from "@/stores/queryStore";
import type { QueryRecord } from "@/lib/types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function useQuery() {
  const {
    records,
    addRecord,
    appendThinkingStep,
    setGeneratedSQL,
    addRetry,
    setResult,
    setStatus,
    clearHistory,
  } = useQueryStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const sendQuery = useCallback(async (question: string) => {
    if (!question.trim() || isLoadingRef.current) return;

    setError(null);
    setIsLoading(true);
    isLoadingRef.current = true;

    const record: QueryRecord = {
      id: generateId(),
      question: question.trim(),
      timestamp: new Date(),
      thinkingSteps: [],
      retries: [],
      status: "streaming",
    };
    addRecord(record);
    const id = record.id;

    try {
      for await (const event of streamQuery(question.trim())) {
        switch (event.type) {
          case "thinking_step":
            // If the same step is already "running", update it; otherwise append
            appendThinkingStep(id, event.data);
            break;

          case "sql_generated":
            setGeneratedSQL(id, event.data.sql);
            break;

          case "sql_executing":
            // no-op — ThinkingPanel already shows progress via thinking_step
            break;

          case "sql_result":
            setResult(id, event.data);
            break;

          case "sql_retry":
            addRetry(id, event.data);
            break;

          case "sql_error":
            setStatus(id, "error", event.data.message);
            break;

          case "done":
            if (!event.data.error) {
              setStatus(id, "done");
            }
            break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : UI_TEXT.networkError;
      setError(msg);
      setStatus(id, "error", msg);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [addRecord, appendThinkingStep, setGeneratedSQL, addRetry, setResult, setStatus]);

  const clearError = useCallback(() => setError(null), []);

  return {
    records,
    isLoading,
    error,
    sendQuery,
    clearHistory,
    clearError,
  };
}
