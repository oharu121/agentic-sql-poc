import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSchema, checkHealth, fetchParquetPreview, streamQuery } from "./api";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ── fetchSchema ───────────────────────────────────────────────────────────────

describe("fetchSchema", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns schema data on a successful response", async () => {
    const schema = {
      tables: [{ name: "area_pl", columns: [], enum_values: {}, sample_rows: [] }],
    };
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(schema) });

    const result = await fetchSchema();
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe("area_pl");
  });

  it("throws with the HTTP status code on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(fetchSchema()).rejects.toThrow("503");
  });
});

// ── checkHealth ───────────────────────────────────────────────────────────────

describe("checkHealth", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns { status: 'ok' } on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });
    const result = await checkHealth();
    expect(result.status).toBe("ok");
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(checkHealth()).rejects.toThrow("Health check failed");
  });
});

// ── fetchParquetPreview ───────────────────────────────────────────────────────

describe("fetchParquetPreview", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns table, columns and rows", async () => {
    const preview = { table: "area_pl", columns: ["エリア", "年度"], rows: [["関東", 2025]] };
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(preview) });

    const result = await fetchParquetPreview("area_pl");
    expect(result.table).toBe("area_pl");
    expect(result.columns).toContain("エリア");
    expect(result.rows).toHaveLength(1);
  });

  it("throws with the HTTP status code on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchParquetPreview("unknown")).rejects.toThrow("404");
  });
});

// ── streamSSE (via streamQuery) ───────────────────────────────────────────────

describe("streamSSE (via streamQuery)", () => {
  beforeEach(() => fetchMock.mockReset());

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const gen = streamQuery("test");
    await expect(gen.next()).rejects.toThrow("500");
  });

  it("throws when there is no response body", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, body: null });
    const gen = streamQuery("test");
    await expect(gen.next()).rejects.toThrow("No response body");
  });

  it("parses a complete SSE event+data pair into a typed object", async () => {
    const sseText =
      "event: thinking_step\n" +
      'data: {"step":"prompt_build","label":"Building…","status":"running"}\n\n';

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseText));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream });

    const events = [];
    for await (const event of streamQuery("test")) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("thinking_step");
    expect((events[0] as { type: string; data: { step: string } }).data.step).toBe("prompt_build");
  });

  it("correctly reassembles SSE data split across two chunks", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode("event: sql_generated\ndata: "),
      encoder.encode('{"sql":"SELECT 1"}\n\n'),
    ];
    let i = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (i < chunks.length) controller.enqueue(chunks[i++]);
        else controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream });

    const events = [];
    for await (const event of streamQuery("test")) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("sql_generated");
    expect((events[0] as { type: string; data: { sql: string } }).data.sql).toBe("SELECT 1");
  });

  it("ignores lines that are not event: or data:", async () => {
    const sseText =
      ": keep-alive\n" +
      "event: done\n" +
      'data: {"processing_time_ms":42}\n\n';

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseText));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream });

    const events = [];
    for await (const event of streamQuery("test")) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("done");
  });
});
