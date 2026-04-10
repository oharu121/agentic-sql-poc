/**
 * Query history store using Zustand with sessionStorage persistence.
 *
 * Each QueryRecord captures the full pipeline state for one question:
 * thinking steps, generated SQL, result data, and retry history.
 * Ephemeral state (isLoading, currentStep) lives in useQuery hook.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { QueryRecord, ThinkingStep, SQLResult, SQLRetry, QueryStatus } from "@/lib/types";

interface QueryState {
  records: QueryRecord[];
  addRecord: (record: QueryRecord) => void;
  updateRecord: (id: string, updates: Partial<QueryRecord>) => void;
  appendThinkingStep: (id: string, step: ThinkingStep) => void;
  updateLastThinkingStep: (id: string, updates: Partial<ThinkingStep>) => void;
  setGeneratedSQL: (id: string, sql: string) => void;
  addRetry: (id: string, retry: SQLRetry) => void;
  setResult: (id: string, result: SQLResult) => void;
  setStatus: (id: string, status: QueryStatus, errorMessage?: string) => void;
  clearHistory: () => void;
}

export const useQueryStore = create<QueryState>()(
  persist(
    (set) => ({
      records: [],

      addRecord: (record) =>
        set((state) => ({ records: [...state.records, record] })),

      updateRecord: (id, updates) =>
        set((state) => ({
          records: state.records.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),

      appendThinkingStep: (id, step) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, thinkingSteps: [...r.thinkingSteps, step] } : r
          ),
        })),

      updateLastThinkingStep: (id, updates) =>
        set((state) => ({
          records: state.records.map((r) => {
            if (r.id !== id || r.thinkingSteps.length === 0) return r;
            const steps = [...r.thinkingSteps];
            steps[steps.length - 1] = { ...steps[steps.length - 1], ...updates };
            return { ...r, thinkingSteps: steps };
          }),
        })),

      setGeneratedSQL: (id, sql) =>
        set((state) => ({
          records: state.records.map((r) => (r.id === id ? { ...r, generatedSQL: sql } : r)),
        })),

      addRetry: (id, retry) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, retries: [...r.retries, retry] } : r
          ),
        })),

      setResult: (id, result) =>
        set((state) => ({
          records: state.records.map((r) => (r.id === id ? { ...r, sqlResult: result } : r)),
        })),

      setStatus: (id, status, errorMessage) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, status, ...(errorMessage ? { errorMessage } : {}) } : r
          ),
        })),

      clearHistory: () => set({ records: [] }),
    }),
    {
      name: "query-storage",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
