/**
 * UI text and API configuration constants.
 */

export const UI_TEXT = {
  appTitle: "Agentic SQL Demo",
  appSubtitle: "Text-to-SQL pipeline with live step visualization",
  inputPlaceholder: "質問を入力してください (e.g. 関東エリアの今期売上は？)",
  networkError: "Network error. Please try again.",
  sendButton: "Send",
  clearButton: "Clear history",
  welcomeMessage: "Ask a question in Japanese",
  welcomeDescription:
    "The agent will translate your question into SQL, execute it against DuckDB, and show you every step of the process.",
} as const;

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860",
  endpoints: {
    query: "/api/query",
    schema: "/api/schema",
    etlRun: "/api/etl/run",
    etlPreview: (table: string) => `/api/etl/preview/${table}`,
    health: "/api/health",
  },
} as const;
