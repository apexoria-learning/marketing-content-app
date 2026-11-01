import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { Database } from "../../src/server/db/database.types";
import { createRecordedAiClient } from "../../src/server/services/recorded-ai";

const metadata = {
  kind: "item_hydration" as const,
  content_item_id: "c862f630-7968-4b35-b048-9b7e9183fef1",
  model: "mock-model",
  prompt_version: "content-v1",
};
const request = {
  messages: [{ role: "user" as const, content: "Generate" }],
  max_tokens: 512,
};
const pricing = { input_usd_per_million: "3", output_usd_per_million: "15" };

function database(fetch: typeof globalThis.fetch) {
  return createClient<Database>("https://database.example.test", "mock-key", {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("per-call generation telemetry", () => {
  it("opens and closes a run with tokens and fixed-point estimated cost", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1 }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const generate = vi.fn().mockResolvedValue({
      content: "{}",
      input_tokens: 100,
      output_tokens: 50,
      duration_ms: 10,
    });
    await createRecordedAiClient(
      database(fetch),
      generate,
      metadata,
      pricing,
    )(request);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toMatchObject({
      status: "success",
      input_tokens: 100,
      output_tokens: 50,
      estimated_cost_usd: 0.00105,
    });
  });

  it("does not call AI if the run cannot be opened", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Denied" }), { status: 403 }),
      );
    const generate = vi.fn();
    await expect(
      createRecordedAiClient(
        database(fetch),
        generate,
        metadata,
        pricing,
      )(request),
    ).rejects.toBeDefined();
    expect(generate).not.toHaveBeenCalled();
  });

  it("records safe failure text, not provider error content", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1 }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const generate = vi
      .fn()
      .mockRejectedValue(new Error("Sensitive provider detail"));
    await expect(
      createRecordedAiClient(
        database(fetch),
        generate,
        metadata,
        pricing,
      )(request),
    ).rejects.toThrow();
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toMatchObject({
      status: "failed",
      error: "Content generation request failed.",
    });
    expect(String(fetch.mock.calls[1]?.[1]?.body)).not.toContain("Sensitive");
  });

  it("refuses missing pricing before any database or AI call", () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const generate = vi.fn();
    expect(() =>
      createRecordedAiClient(database(fetch), generate, metadata, {
        input_usd_per_million: "",
        output_usd_per_million: "",
      }),
    ).toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});
