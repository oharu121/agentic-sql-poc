/**
 * Backend API client with SSE streaming support.
 * Mirrors the pattern from rich-chat-demo/frontend/lib/api.ts.
 */

import { API_CONFIG } from "./constants";
import type { SQLSSEEvent, ETLSSEEvent, SchemaResponse } from "./types";

const { baseUrl, endpoints } = API_CONFIG;

// ── SSE helper ────────────────────────────────────────────────────────────────

async function* streamSSE<T>(
  url: string,
  body: Record<string, unknown>
): AsyncGenerator<T, void, unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ") && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          yield { type: currentEvent, data } as T;
        } catch {
          // ignore parse errors
        }
        currentEvent = null;
      }
    }
  }
}

// ── Query endpoint ────────────────────────────────────────────────────────────

export async function* streamQuery(
  question: string
): AsyncGenerator<SQLSSEEvent, void, unknown> {
  yield* streamSSE<SQLSSEEvent>(`${baseUrl}${endpoints.query}`, { question });
}

// ── ETL endpoints ─────────────────────────────────────────────────────────────

export async function* streamETL(): AsyncGenerator<ETLSSEEvent, void, unknown> {
  yield* streamSSE<ETLSSEEvent>(`${baseUrl}${endpoints.etlRun}`, {});
}

export async function fetchParquetPreview(
  table: string
): Promise<{ table: string; columns: string[]; rows: unknown[][] }> {
  const response = await fetch(`${baseUrl}${endpoints.etlPreview(table)}`);
  if (!response.ok) throw new Error(`Preview failed: ${response.status}`);
  return response.json();
}

export async function fetchExcelPreview(
  table: string
): Promise<{ table: string; source_file: string; columns: string[]; rows: unknown[][] }> {
  const response = await fetch(`${baseUrl}${endpoints.excelPreview(table)}`);
  if (!response.ok) throw new Error(`Excel preview failed: ${response.status}`);
  return response.json();
}

// ── Schema endpoint ───────────────────────────────────────────────────────────

export async function fetchSchema(): Promise<SchemaResponse> {
  const response = await fetch(`${baseUrl}${endpoints.schema}`);
  if (!response.ok) throw new Error(`Schema fetch failed: ${response.status}`);
  return response.json();
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${baseUrl}${endpoints.health}`);
  if (!response.ok) throw new Error("Health check failed");
  return response.json();
}
