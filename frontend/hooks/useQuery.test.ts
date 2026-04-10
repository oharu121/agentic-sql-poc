import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useQuery } from "./useQuery";
import { useQueryStore } from "@/stores/queryStore";

// Mock the entire API module so no real fetch calls happen
vi.mock("@/lib/api", () => ({
  streamQuery: vi.fn(),
  streamETL: vi.fn(),
  fetchSchema: vi.fn(),
  fetchParquetPreview: vi.fn(),
  checkHealth: vi.fn(),
}));

import * as api from "@/lib/api";

/** Returns an async generator function that yields the given events in order. */
function makeStream(...events: object[]) {
  return async function* () {
    for (const event of events) yield event;
  };
}

describe("useQuery", () => {
  beforeEach(() => {
    useQueryStore.setState({ records: [] });
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  // ── sendQuery ──────────────────────────────────────────────────────────────

  it("creates a record and processes thinking_step events", async () => {
    vi.mocked(api.streamQuery).mockImplementation(
      makeStream(
        { type: "thinking_step", data: { step: "prompt_build", label: "Building…", status: "running" } },
        { type: "done", data: { processing_time_ms: 100 } }
      )
    );

    const { result } = renderHook(() => useQuery());
    await act(async () => { await result.current.sendQuery("関東の売上は？"); });

    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].question).toBe("関東の売上は？");
    expect(result.current.records[0].thinkingSteps).toHaveLength(1);
    expect(result.current.records[0].status).toBe("done");
  });

  it("sets generatedSQL on sql_generated event", async () => {
    vi.mocked(api.streamQuery).mockImplementation(
      makeStream(
        { type: "sql_generated", data: { sql: 'SELECT SUM("売上_実績") AS t FROM area_pl' } },
        { type: "done", data: { processing_time_ms: 50 } }
      )
    );

    const { result } = renderHook(() => useQuery());
    await act(async () => { await result.current.sendQuery("test"); });

    expect(result.current.records[0].generatedSQL).toBe('SELECT SUM("売上_実績") AS t FROM area_pl');
  });

  it("stores sql result on sql_result event", async () => {
    vi.mocked(api.streamQuery).mockImplementation(
      makeStream(
        { type: "sql_result", data: { columns: ["total"], rows: [[2383]], row_count: 1 } },
        { type: "done", data: { processing_time_ms: 50 } }
      )
    );

    const { result } = renderHook(() => useQuery());
    await act(async () => { await result.current.sendQuery("test"); });

    expect(result.current.records[0].sqlResult?.row_count).toBe(1);
    expect(result.current.records[0].sqlResult?.columns).toEqual(["total"]);
  });

  it("sets status to error and stores errorMessage on sql_error event", async () => {
    vi.mocked(api.streamQuery).mockImplementation(
      makeStream(
        { type: "sql_error", data: { message: "All retries failed", final_sql: "SELECT ?" } },
        { type: "done", data: { processing_time_ms: 100, error: "All retries failed" } }
      )
    );

    const { result } = renderHook(() => useQuery());
    await act(async () => { await result.current.sendQuery("bad query"); });

    expect(result.current.records[0].status).toBe("error");
    expect(result.current.records[0].errorMessage).toBe("All retries failed");
  });

  it("appends a retry entry on sql_retry event", async () => {
    vi.mocked(api.streamQuery).mockImplementation(
      makeStream(
        { type: "sql_retry", data: { attempt: 1, error: "col not found", corrected_sql: "SELECT 1" } },
        { type: "sql_result", data: { columns: ["c"], rows: [[1]], row_count: 1 } },
        { type: "done", data: { processing_time_ms: 200 } }
      )
    );

    const { result } = renderHook(() => useQuery());
    await act(async () => { await result.current.sendQuery("test"); });

    expect(result.current.records[0].retries).toHaveLength(1);
    expect(result.current.records[0].retries[0].attempt).toBe(1);
  });

  // ── error handling ────────────────────────────────────────────────────────

  it("sets hook error state and record status to error on network failure", async () => {
    vi.mocked(api.streamQuery).mockImplementation(async function* () {
      throw new Error("fetch failed");
      // satisfy async generator return type
      yield undefined as never;
    });

    const { result } = renderHook(() => useQuery());
    await act(async () => { await result.current.sendQuery("test"); });

    expect(result.current.error).toContain("fetch failed");
    expect(result.current.records[0].status).toBe("error");
  });

  it("clearError resets the hook error state", async () => {
    vi.mocked(api.streamQuery).mockImplementation(async function* () {
      throw new Error("boom");
      yield undefined as never;
    });

    const { result } = renderHook(() => useQuery());
    await act(async () => { await result.current.sendQuery("test"); });
    expect(result.current.error).toBeTruthy();

    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });

  // ── guards ────────────────────────────────────────────────────────────────

  it("ignores whitespace-only questions without creating a record", async () => {
    const { result } = renderHook(() => useQuery());
    await act(async () => { await result.current.sendQuery("   "); });

    expect(result.current.records).toHaveLength(0);
    expect(api.streamQuery).not.toHaveBeenCalled();
  });

  it("ignores a second sendQuery call while one is already in flight", async () => {
    let unblock!: () => void;
    const blocked = new Promise<void>((r) => { unblock = r; });

    vi.mocked(api.streamQuery).mockImplementation(async function* () {
      await blocked;
      yield { type: "done", data: { processing_time_ms: 50 } };
    });

    const { result } = renderHook(() => useQuery());

    // Fire first (non-awaited) — it hangs on `blocked`
    act(() => { result.current.sendQuery("first"); });
    await waitFor(() => expect(result.current.isLoading).toBe(true));

    // Second call should be a no-op
    await act(async () => { await result.current.sendQuery("second"); });
    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].question).toBe("first");

    unblock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  // ── isLoading lifecycle ───────────────────────────────────────────────────

  it("isLoading is true while streaming and false after completion", async () => {
    let unblock!: () => void;
    const blocked = new Promise<void>((r) => { unblock = r; });

    vi.mocked(api.streamQuery).mockImplementation(async function* () {
      await blocked;
      yield { type: "done", data: { processing_time_ms: 50 } };
    });

    const { result } = renderHook(() => useQuery());

    act(() => { result.current.sendQuery("test"); });
    await waitFor(() => expect(result.current.isLoading).toBe(true));

    unblock();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.records[0].status).toBe("done");
  });
});
