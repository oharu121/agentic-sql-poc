import { describe, it, expect, beforeEach } from "vitest";
import { useQueryStore } from "./queryStore";
import type { QueryRecord } from "@/lib/types";

function makeRecord(id = "test-id"): QueryRecord {
  return {
    id,
    question: "関東の売上は？",
    timestamp: new Date(),
    thinkingSteps: [],
    retries: [],
    status: "streaming",
  };
}

describe("queryStore", () => {
  beforeEach(() => {
    useQueryStore.setState({ records: [] });
    sessionStorage.clear();
  });

  // ── addRecord ───────────────────────────────────────────────────────────────

  it("addRecord appends a record to an empty store", () => {
    useQueryStore.getState().addRecord(makeRecord());
    expect(useQueryStore.getState().records).toHaveLength(1);
    expect(useQueryStore.getState().records[0].id).toBe("test-id");
  });

  it("addRecord preserves existing records", () => {
    useQueryStore.getState().addRecord(makeRecord("a"));
    useQueryStore.getState().addRecord(makeRecord("b"));
    expect(useQueryStore.getState().records).toHaveLength(2);
  });

  // ── appendThinkingStep ─────────────────────────────────────────────────────

  it("appendThinkingStep adds a step to the matching record", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().appendThinkingStep("test-id", {
      step: "prompt_build",
      label: "Building system prompt…",
      status: "running",
    });
    const steps = useQueryStore.getState().records[0].thinkingSteps;
    expect(steps).toHaveLength(1);
    expect(steps[0].step).toBe("prompt_build");
  });

  // ── updateLastThinkingStep ─────────────────────────────────────────────────

  it("updateLastThinkingStep updates only the last step, leaving earlier steps intact", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().appendThinkingStep("test-id", {
      step: "prompt_build",
      label: "Building…",
      status: "running",
    });
    useQueryStore.getState().appendThinkingStep("test-id", {
      step: "llm_call",
      label: "Calling LLM…",
      status: "running",
    });
    useQueryStore.getState().updateLastThinkingStep("test-id", { status: "done", elapsed_ms: 250 });

    const steps = useQueryStore.getState().records[0].thinkingSteps;
    expect(steps[0].status).toBe("running"); // first step unchanged
    expect(steps[1].status).toBe("done");
    expect(steps[1].elapsed_ms).toBe(250);
  });

  it("updateLastThinkingStep does nothing when the record has no steps", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().updateLastThinkingStep("test-id", { status: "done" });
    expect(useQueryStore.getState().records[0].thinkingSteps).toHaveLength(0);
  });

  // ── setGeneratedSQL ────────────────────────────────────────────────────────

  it("setGeneratedSQL sets the sql on the matching record", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().setGeneratedSQL("test-id", 'SELECT SUM("売上_実績") FROM area_pl');
    expect(useQueryStore.getState().records[0].generatedSQL).toBe(
      'SELECT SUM("売上_実績") FROM area_pl'
    );
  });

  // ── addRetry ───────────────────────────────────────────────────────────────

  it("addRetry appends a retry entry", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().addRetry("test-id", {
      attempt: 1,
      error: "column not found",
      corrected_sql: "SELECT 1",
    });
    const retries = useQueryStore.getState().records[0].retries;
    expect(retries).toHaveLength(1);
    expect(retries[0].attempt).toBe(1);
  });

  // ── setResult ─────────────────────────────────────────────────────────────

  it("setResult stores the sql result on the matching record", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().setResult("test-id", {
      columns: ["total"],
      rows: [[2383]],
      row_count: 1,
    });
    const record = useQueryStore.getState().records[0];
    expect(record.sqlResult?.row_count).toBe(1);
    expect(record.sqlResult?.columns).toEqual(["total"]);
  });

  // ── setStatus ─────────────────────────────────────────────────────────────

  it("setStatus updates the status field", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().setStatus("test-id", "done");
    expect(useQueryStore.getState().records[0].status).toBe("done");
  });

  it("setStatus stores errorMessage when provided", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().setStatus("test-id", "error", "Query failed after 3 attempts");
    const record = useQueryStore.getState().records[0];
    expect(record.status).toBe("error");
    expect(record.errorMessage).toBe("Query failed after 3 attempts");
  });

  it("setStatus without errorMessage does not add errorMessage property", () => {
    useQueryStore.getState().addRecord(makeRecord());
    useQueryStore.getState().setStatus("test-id", "done");
    expect(useQueryStore.getState().records[0].errorMessage).toBeUndefined();
  });

  // ── clearHistory ───────────────────────────────────────────────────────────

  it("clearHistory removes all records", () => {
    useQueryStore.getState().addRecord(makeRecord("a"));
    useQueryStore.getState().addRecord(makeRecord("b"));
    useQueryStore.getState().clearHistory();
    expect(useQueryStore.getState().records).toHaveLength(0);
  });

  // ── isolation ─────────────────────────────────────────────────────────────

  it("operations on an unknown id do not mutate other records", () => {
    useQueryStore.getState().addRecord(makeRecord("real-id"));
    useQueryStore.getState().setGeneratedSQL("nonexistent-id", "SELECT 1");
    expect(useQueryStore.getState().records[0].generatedSQL).toBeUndefined();
  });
});
