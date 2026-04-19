"use client";

import { useCallback, useRef, useState } from "react";
import { streamEvaluation } from "@/lib/api";
import { UI_TEXT } from "@/lib/constants";
import type { EvaluationScore, QueryRecord, ThinkingStep } from "@/lib/types";

/**
 * Test-mode hook. Mirrors useQuery's record shape so QueryCard renders each
 * test question identically to a free-chat question, then attaches a Scoring
 * once the backend emits eval_query_scored.
 */
export function useEvaluation() {
  const [records, setRecords] = useState<QueryRecord[]>([]);
  const [summary, setSummary] = useState<EvaluationScore | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRunningRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);

  const updateCurrent = useCallback((updater: (r: QueryRecord) => QueryRecord) => {
    const id = currentIdRef.current;
    if (!id) return;
    setRecords((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
  }, []);

  const runEvaluation = useCallback(async () => {
    if (isRunningRef.current) return;

    setError(null);
    setSummary(null);
    setRecords([]);
    setIsRunning(true);
    isRunningRef.current = true;
    currentIdRef.current = null;

    try {
      for await (const event of streamEvaluation()) {
        switch (event.type) {
          case "eval_query_start": {
            const record: QueryRecord = {
              id: event.data.id,
              question: event.data.question,
              timestamp: new Date(),
              thinkingSteps: [],
              retries: [],
              status: "streaming",
              category: event.data.category,
              difficulty: event.data.difficulty,
            };
            currentIdRef.current = record.id;
            setRecords((prev) => [...prev, record]);
            break;
          }

          case "thinking_step":
            updateCurrent((r) => ({
              ...r,
              thinkingSteps: [...r.thinkingSteps, event.data as ThinkingStep],
            }));
            break;

          case "sql_generated":
            updateCurrent((r) => ({ ...r, generatedSQL: event.data.sql }));
            break;

          case "sql_executing":
            // Render via thinking_step events; nothing to do.
            break;

          case "sql_result":
            updateCurrent((r) => ({ ...r, sqlResult: event.data }));
            break;

          case "sql_retry":
            updateCurrent((r) => ({ ...r, retries: [...r.retries, event.data] }));
            break;

          case "sql_error":
            updateCurrent((r) => ({
              ...r,
              status: "error",
              errorMessage: event.data.message,
            }));
            break;

          case "done":
            updateCurrent((r) => (r.status === "error" ? r : { ...r, status: "done" }));
            break;

          case "eval_query_scored":
            updateCurrent((r) => ({ ...r, scoring: event.data.scoring }));
            break;

          case "eval_complete":
            setSummary(event.data.score);
            break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : UI_TEXT.networkError;
      setError(msg);
    } finally {
      setIsRunning(false);
      isRunningRef.current = false;
      currentIdRef.current = null;
    }
  }, [updateCurrent]);

  const reset = useCallback(() => {
    if (isRunningRef.current) return;
    setRecords([]);
    setSummary(null);
    setError(null);
  }, []);

  return { records, summary, isRunning, error, runEvaluation, reset };
}
