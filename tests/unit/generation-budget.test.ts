import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  env: {
    AI_GENERATION_ENABLED: "true",
    REGEN_DAILY_LIMIT: 20,
    GLOBAL_DAILY_AI_LIMIT: 100,
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({ env: mocks.env }));
vi.mock("../../src/server/db/client", () => ({
  createUserDatabaseClient: async () => ({ rpc: mocks.rpc }),
}));
import { consumeGenerationBudget } from "../../src/server/security";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.AI_GENERATION_ENABLED = "true";
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});

describe("AI generation allowance", () => {
  it("uses an atomic JWT-derived budget with the additional month cap", async () => {
    expect(await consumeGenerationBudget("user@example.test", true)).toEqual({
      ok: true,
      data: undefined,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("consume_ai_budget", {
      p_user_limit: 20,
      p_global_limit: 100,
      p_plan_month: true,
    });
  });

  it("returns next IST midnight on denial instead of calling a generation operation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T18:29:00Z"));
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const result = await consumeGenerationBudget("user@example.test");
    expect(result).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retry_after: "2026-11-01T18:30:00.000Z",
    });
    vi.useRealTimers();
  });

  it("blocks inactive generation without charging any quota", async () => {
    mocks.env.AI_GENERATION_ENABLED = "false";
    expect(await consumeGenerationBudget("user@example.test")).toMatchObject({
      ok: false,
      code: "GENERATION_FAILED",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("surfaces quota persistence failures", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error("Unavailable"),
    });
    await expect(consumeGenerationBudget("user@example.test")).rejects.toThrow(
      "Unavailable",
    );
  });
});
