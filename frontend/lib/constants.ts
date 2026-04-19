/**
 * UI text and API configuration constants.
 */

export const UI_TEXT = {
  appTitle: "Agentic SQL Demo",
  appSubtitle: "ステップを可視化するText-to-SQLパイプライン",
  inputPlaceholder: "質問を入力してください (例: 関東エリアの今期売上は？)",
  networkError: "ネットワークエラーが発生しました。もう一度お試しください。",
  sendButton: "送信",
  clearButton: "履歴をクリア",
  welcomeMessage: "日本語で質問してください",
  welcomeDescription:
    "エージェントが質問をSQLに変換し、DuckDBで実行して、処理の全ステップを表示します。",
} as const;

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860",
  endpoints: {
    query: "/api/query",
    schema: "/api/schema",
    etlRun: "/api/etl/run",
    etlPreview: (table: string) => `/api/etl/preview/${table}`,
    excelPreview: (table: string) => `/api/etl/excel-preview/${table}`,
    health: "/api/health",
  },
} as const;
