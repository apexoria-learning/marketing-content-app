import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { hydrateBatch } from "../../src/server/services/hydration-batch";
import { generateDailyTip } from "../../src/server/ai/generators/daily-tip";
import { ActionFailure } from "../../src/server/services/service-error";
vi.mock("../../src/server/services/content-generation", () => ({
  generateContentItemWithClient: vi.fn(),
}));

const rows = Array.from({ length: 30 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
}));

describe("bounded hydration batch", () => {
  it("processes exactly 30 items within the 240-second budget at 8 seconds/item", async () => {
    let now = 0;
    const hydrate = vi.fn().mockImplementation(async () => {
      now += 8000;
    });
    const result = await hydrateBatch(
      {
        listIdeas: async () => rows,
        hydrate,
        recordFailure: vi.fn(),
      },
      { clock: () => now },
    );
    expect(result).toEqual({
      attempted: 30,
      completed: 30,
      failed: 0,
      remaining: 0,
    });
    expect(now).toBe(240000);
  });

  it("stops without starting item 21 when each item consumes 12 seconds", async () => {
    let now = 0;
    const hydrate = vi.fn().mockImplementation(async () => {
      now += 12000;
    });
    const result = await hydrateBatch(
      {
        listIdeas: async () => rows,
        hydrate,
        recordFailure: vi.fn(),
      },
      { clock: () => now },
    );
    expect(result).toEqual({
      attempted: 20,
      completed: 20,
      failed: 0,
      remaining: 10,
    });
    expect(hydrate.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });

  it("records per-item failure explicitly and continues with later items", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hydrate = vi
      .fn()
      .mockRejectedValueOnce(
        new ActionFailure("GENERATION_FAILED", "Provider detail"),
      )
      .mockResolvedValue(undefined);
    const recordFailure = vi.fn();
    const result = await hydrateBatch({
      listIdeas: async () => rows.slice(0, 2),
      hydrate,
      recordFailure,
    });
    expect(result).toEqual({
      attempted: 2,
      completed: 1,
      failed: 1,
      remaining: 0,
    });
    expect(recordFailure).toHaveBeenCalledWith(
      rows[0]?.id,
      "Content generation did not complete.",
    );
  });

  it("starts no request after cancellation and surfaces telemetry failures", async () => {
    const controller = new AbortController();
    controller.abort();
    const hydrate = vi.fn();
    const result = await hydrateBatch(
      {
        listIdeas: async () => rows,
        hydrate,
        recordFailure: vi.fn(),
      },
      { signal: controller.signal },
    );
    expect(result.attempted).toBe(0);
    expect(hydrate).not.toHaveBeenCalled();
    await expect(
      hydrateBatch({
        listIdeas: async () => rows.slice(0, 1),
        hydrate: vi
          .fn()
          .mockRejectedValue(new ActionFailure("GENERATION_FAILED", "Failed")),
        recordFailure: vi.fn().mockRejectedValue(new Error("Telemetry failed")),
      }),
    ).rejects.toThrow("Telemetry failed");
  });
  it("stops the batch immediately if per-call run logging or infrastructure fails", async () => {
    const failure = new Error("Run telemetry failed");
    const hydrate = vi.fn().mockRejectedValue(failure);
    const recordFailure = vi.fn();
    await expect(
      hydrateBatch({
        listIdeas: async () => rows.slice(0, 2),
        hydrate,
        recordFailure,
      }),
    ).rejects.toBe(failure);
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(recordFailure).not.toHaveBeenCalled();
  });
});

describe("daily tip generation", () => {
  const topic = {
    tip_topic: "Python programming",
    audience_description: "Career switchers learning to code",
  };

  it("preserves valid output with prompt version", async () => {
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        tip: "Use test isolation for Apex unit tests.",
        category: "Apex",
      }),
    });
    expect(
      await generateDailyTip(
        { recentTips: ["Use flow debug logs"], topic },
        generate,
      ),
    ).toEqual({
      tip: "Use test isolation for Apex unit tests.",
      category: "Apex",
      prompt_version: "daily-tip-v2",
    });
    expect(generate).toHaveBeenCalledTimes(1);
    // The topic comes from the business profile, JSON-encoded as data.
    const system = generate.mock.calls[0]?.[0].messages[0].content;
    expect(system).toContain('"tip_topic":"Python programming"');
    expect(system).not.toMatch(/salesforce/i);
  });

  it("repairs repeated topics once and rejects persistent repeats", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        tip: "Use flow debug logs.",
        category: "Flows",
      }),
    });
    await expect(
      generateDailyTip(
        { recentTips: ["Use flow debug logs!"], topic },
        generate,
      ),
    ).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
