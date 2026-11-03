import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  lookup: vi.fn(),
  config: {
    aiGenerationEnabled: true,
    regenDailyLimit: 20,
    globalDailyAiLimit: 100,
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({
  env: { ADMIN_EMAILS: "", ALLOWED_EMAILS: "" },
}));
vi.mock("../../src/server/db/client", () => ({
  createUserDatabaseClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("../../src/server/db/settings", () => ({
  getRuntimeConfig: async () => mocks.config,
}));
vi.mock("../../src/server/auth/access", () => ({
  lookupAccess: mocks.lookup,
}));
import { consumeGenerationBudget } from "../../src/server/security";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.aiGenerationEnabled = true;
  mocks.config.regenDailyLimit = 20;
  mocks.config.globalDailyAiLimit = 100;
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.lookup.mockResolvedValue({
    allowed: true,
    role: "member",
    canGenerate: true,
    source: "database",
  });
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

  it("charges the limits an admin set at runtime", async () => {
    mocks.config.regenDailyLimit = 5;
    mocks.config.globalDailyAiLimit = 40;
    await consumeGenerationBudget("user@example.test");
    expect(mocks.rpc).toHaveBeenCalledWith("consume_ai_budget", {
      p_user_limit: 5,
      p_global_limit: 40,
      p_plan_month: false,
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
    mocks.config.aiGenerationEnabled = false;
    expect(await consumeGenerationBudget("user@example.test")).toMatchObject({
      ok: false,
      code: "GENERATION_FAILED",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("blocks a person whose AI access an admin turned off, without charging quota", async () => {
    mocks.lookup.mockResolvedValue({
      allowed: true,
      role: "member",
      canGenerate: false,
      source: "database",
    });
    expect(await consumeGenerationBudget("user@example.test")).toEqual({
      ok: false,
      code: "GENERATION_FAILED",
      message:
        "AI generation isn't enabled for your account. Nothing was changed.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when access cannot be re-read", async () => {
    mocks.lookup.mockResolvedValue(null);
    await expect(consumeGenerationBudget("user@example.test")).rejects.toThrow(
      "Access list unavailable.",
    );
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
