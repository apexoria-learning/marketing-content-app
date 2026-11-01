import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../src/server/db/database.types";
vi.mock("server-only", () => ({}));
import { ensureDailyTip } from "../../src/server/services/daily-tip";

const previous = {
  id: "c862f630-7968-4b35-b048-9b7e9183fef1",
  tip_date: "2026-10-31",
  tip: "Use descriptive API field names.",
  category: "Admin",
  prompt_version: "daily-tip-v1",
  created_at: "2026-10-31T00:00:00Z",
};
function database(existing = previous, saveStatus = 200) {
  const writes = vi.fn();
  const client = createClient<Database>("https://example.test", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        if (init?.method === "POST") {
          writes(JSON.parse(String(init.body)));
          return new Response(
            JSON.stringify(
              saveStatus === 200
                ? {
                    ...previous,
                    ...JSON.parse(String(init.body)),
                    tip_date: "2026-11-01",
                  }
                : { code: "XX000", message: "Persistence unavailable" },
            ),
            {
              status: saveStatus,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(
          JSON.stringify(
            url.searchParams.get("select") === "tip"
              ? [{ tip: existing.tip }]
              : existing,
          ),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  });
  return { client, writes };
}
describe("daily tip persistence", () => {
  it("does not generate or overwrite an existing tip for today", async () => {
    const db = database({ ...previous, tip_date: "2026-11-01" });
    const generate = vi.fn();
    expect(
      await ensureDailyTip(db.client, "2026-11-01", generate),
    ).toMatchObject({ status: "existing" });
    expect(generate).not.toHaveBeenCalled();
    expect(db.writes).not.toHaveBeenCalled();
  });
  it("persists validated output with its actual date and prompt version", async () => {
    const db = database();
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        tip: "Debug a flow using the flow debugger.",
        category: "Automation",
      }),
    });
    expect(
      await ensureDailyTip(db.client, "2026-11-01", generate),
    ).toMatchObject({ status: "generated" });
    expect(db.writes).toHaveBeenCalledWith({
      tip_date: "2026-11-01",
      tip: "Debug a flow using the flow debugger.",
      category: "Automation",
      prompt_version: "daily-tip-v1",
    });
  });
  it("explicitly reports generation failure while retaining yesterday's saved tip", async () => {
    const db = database();
    const generate = vi.fn().mockResolvedValue({ content: "not JSON" });
    expect(await ensureDailyTip(db.client, "2026-11-01", generate)).toEqual({
      status: "failed",
      tip: previous,
    });
    expect(db.writes).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("does not disguise database failures as a successful fallback", async () => {
    const db = database(previous, 500);
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        tip: "Debug a flow using the flow debugger.",
        category: "Automation",
      }),
    });
    await expect(
      ensureDailyTip(db.client, "2026-11-01", generate),
    ).rejects.toMatchObject({ code: "XX000" });
  });
});
