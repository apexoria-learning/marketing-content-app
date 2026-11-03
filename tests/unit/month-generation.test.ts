import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAiClient: vi.fn(),
  planMonth: vi.fn(),
  consumeGenerationBudget: vi.fn(),
  existingPlan: null as { id: string } | null,
  planQuery: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({
  env: { PORTKEY_API_KEY: "server-held-key" },
}));
vi.mock("../../src/server/db/settings", () => ({
  getRuntimeConfig: async () => ({
    aiModel: "@test/model",
    aiBaseUrl: "https://gateway.example.test/v1",
    planningHorizonMonths: 2,
    enabledPillars: ["memes", "salesforce_tips", "career_guidance"],
  }),
  getActiveInstructions: async () => null,
}));
vi.mock("../../src/server/services/planning-scope", () => ({
  loadPlanningScope: async () => ({
    filters: {
      platforms: [{ key: "linkedin", formats: ["post", "poll"] }],
      pillars: ["memes", "salesforce_tips", "career_guidance"],
    },
    anchor: { platform: "linkedin", format: "post" },
  }),
}));
vi.mock("../../src/server/db/client", () => ({
  createUserDatabaseClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            mocks.planQuery(table, column, value);
            return { data: mocks.existingPlan, error: null };
          },
        }),
      }),
    }),
  }),
}));
vi.mock("../../src/server/ai/client", () => ({
  createAiClient: mocks.createAiClient,
}));
vi.mock("../../src/server/services/planning", () => ({
  planMonth: mocks.planMonth,
}));
vi.mock("../../src/server/security", () => ({
  consumeGenerationBudget: mocks.consumeGenerationBudget,
}));
vi.mock("../../src/lib/utils/dates", async (original) => ({
  ...(await original<typeof import("../../src/lib/utils/dates")>()),
  todayInIst: () => "2026-11-01",
}));

import {
  generateMonth,
  getMonthPlanAllowance,
} from "../../src/server/services/month-generation";
import { MONTH_PLAN_REQUEST_TIMEOUT_MS } from "../../src/server/ai/generators/month-plan";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.existingPlan = null;
  mocks.createAiClient.mockReturnValue(vi.fn());
  mocks.planMonth.mockResolvedValue({ plan_id: "id", item_count: 30 });
  mocks.consumeGenerationBudget.mockResolvedValue({
    ok: true,
    data: undefined,
  });
});

it("gives whole-month planning a bounded deadline that fits one repair in the work budget", async () => {
  await generateMonth("2026-12");
  expect(mocks.createAiClient).toHaveBeenCalledWith(expect.anything(), {
    timeoutMs: MONTH_PLAN_REQUEST_TIMEOUT_MS,
  });
  expect(MONTH_PLAN_REQUEST_TIMEOUT_MS).toBeGreaterThan(60000);
  expect(MONTH_PLAN_REQUEST_TIMEOUT_MS * 2).toBeLessThanOrEqual(240000);
});

it("plans only with the catalogue platforms and pillars an admin enabled", async () => {
  await generateMonth("2026-12");
  expect(mocks.planMonth.mock.calls[0]?.[0]).toMatchObject({
    horizonMonths: 2,
    filters: {
      platforms: [{ key: "linkedin", formats: ["post", "poll"] }],
      pillars: ["memes", "salesforce_tips", "career_guidance"],
    },
  });
});

describe("month-plan allowance", () => {
  it("refuses an already planned month without charging quota", async () => {
    mocks.existingPlan = { id: "c862f630-7968-4b35-b048-9b7e9183fef1" };
    expect(await getMonthPlanAllowance("2026-11", "user@example.test")).toEqual(
      {
        ok: false,
        code: "VALIDATION",
        message: "This month is already planned. Nothing was changed.",
      },
    );
    expect(mocks.planQuery).toHaveBeenCalledWith(
      "content_plans",
      "plan_month",
      "2026-11-01",
    );
    expect(mocks.consumeGenerationBudget).not.toHaveBeenCalled();
  });

  it("refuses an out-of-horizon month before any database or quota call", async () => {
    expect(
      await getMonthPlanAllowance("2027-02", "user@example.test"),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(mocks.planQuery).not.toHaveBeenCalled();
    expect(mocks.consumeGenerationBudget).not.toHaveBeenCalled();
  });

  it("charges the month-planning budget only for an unplanned month", async () => {
    expect(await getMonthPlanAllowance("2026-12", "user@example.test")).toEqual(
      { ok: true, data: undefined },
    );
    expect(mocks.consumeGenerationBudget).toHaveBeenCalledWith(
      "user@example.test",
      true,
    );
  });
});
