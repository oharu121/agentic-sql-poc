/**
 * TypeScript types for the agentic SQL demo.
 * SSE event types mirror the backend's event emission in backend/app/agents/sql_agent.py.
 */

// ── Table schema (from GET /api/schema) ──────────────────────────────────────

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  enum_values: Record<string, string[]>;
  sample_rows: unknown[][];
}

export interface SchemaResponse {
  tables: TableSchema[];
}

// ── Query state ───────────────────────────────────────────────────────────────

export type ThinkingStepStatus = "running" | "done" | "error";

export type ThinkingStepName =
  | "prompt_build"
  | "llm_call"
  | "sql_extract"
  | "sql_execute"
  | "sql_retry"
  | "sql_done";

export interface ThinkingStep {
  step: ThinkingStepName | string;
  label: string;
  detail?: string;
  status: ThinkingStepStatus;
  elapsed_ms?: number;
}

export interface SQLRetry {
  attempt: number;
  error: string;
  corrected_sql: string;
}

export interface SQLResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
}

export type QueryStatus = "streaming" | "done" | "error";

export interface Scoring {
  is_correct: boolean;
  method: "result_match" | "term_match" | "none";
  results_match: boolean;
  found_terms: string[];
  missing_terms: string[];
  prohibited_found: string[];
  explanation: string;
}

export interface QueryRecord {
  id: string;
  question: string;
  timestamp: Date;
  thinkingSteps: ThinkingStep[];
  generatedSQL?: string;
  sqlResult?: SQLResult;
  retries: SQLRetry[];
  status: QueryStatus;
  errorMessage?: string;
  /** Test-mode metadata: present only for evaluation runs. */
  category?: "general" | "exception";
  difficulty?: string;
  scoring?: Scoring;
}

// ── Evaluation state ──────────────────────────────────────────────────────────

export interface CategoryScore {
  correct: number;
  total: number;
  percentage: number;
}

export interface EvaluationScore {
  correct: number;
  total: number;
  percentage: number;
  by_category: Record<string, CategoryScore>;
}

// ── ETL state ─────────────────────────────────────────────────────────────────

export type ETLStepStatus = "idle" | "running" | "done" | "error";

export interface ETLStepState {
  step: string;
  label: string;
  file: string;
  status: ETLStepStatus;
  detail?: string;
}

// ── SSE event types ───────────────────────────────────────────────────────────

export interface SSEThinkingStepEvent {
  type: "thinking_step";
  data: ThinkingStep;
}

export interface SSESQLGeneratedEvent {
  type: "sql_generated";
  data: { sql: string };
}

export interface SSESQLExecutingEvent {
  type: "sql_executing";
  data: { attempt: number };
}

export interface SSESQLResultEvent {
  type: "sql_result";
  data: SQLResult;
}

export interface SSESQLRetryEvent {
  type: "sql_retry";
  data: SQLRetry;
}

export interface SSESQLErrorEvent {
  type: "sql_error";
  data: { message: string; final_sql: string };
}

export interface SSEDoneEvent {
  type: "done";
  data: { processing_time_ms: number; error?: string };
}

export interface SSEETLStepEvent {
  type: "etl_step";
  data: ETLStepState;
}

export type SQLSSEEvent =
  | SSEThinkingStepEvent
  | SSESQLGeneratedEvent
  | SSESQLExecutingEvent
  | SSESQLResultEvent
  | SSESQLRetryEvent
  | SSESQLErrorEvent
  | SSEDoneEvent;

export type ETLSSEEvent = SSEETLStepEvent | SSEDoneEvent;

// ── Evaluation SSE events ─────────────────────────────────────────────────────

export interface SSEEvalQueryStartEvent {
  type: "eval_query_start";
  data: {
    id: string;
    category: "general" | "exception";
    difficulty?: string;
    question: string;
    index: number;
    total: number;
  };
}

export interface SSEEvalQueryScoredEvent {
  type: "eval_query_scored";
  data: { id: string; scoring: Scoring };
}

export interface SSEEvalCompleteEvent {
  type: "eval_complete";
  data: { score: EvaluationScore; processing_time_ms: number };
}

export type EvalSSEEvent =
  | SSEEvalQueryStartEvent
  | SSEEvalQueryScoredEvent
  | SSEEvalCompleteEvent
  | SQLSSEEvent;
