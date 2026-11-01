import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAiClient: vi.fn(),
  planMonth: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({
  env: { AI_MODEL: "@test/model", PLANNING_HORIZON_MONTHS: 2 },
}));
vi.mock("../../src/server/db/client", () => ({
  createUserDatabaseClient: async () => ({}),
}));
vi.mock("../../src/server/ai/client", () => ({
  createAiClient: mocks.createAiClient,
}));
vi.mock("../../src/server/services/planning", () => ({
  planMonth: mocks.planMonth,
}));

import { generateMonth } from "../../src/server/services/month-generation";
import { MONTH_PLAN_REQUEST_TIMEOUT_MS } from "../../src/server/ai/generators/month-plan";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAiClient.mockReturnValue(vi.fn());
  mocks.planMonth.mockResolvedValue({ plan_id: "id", item_count: 30 });
});

it("gives whole-month planning a bounded deadline that fits one repair in the work budget", async () => {
  await generateMonth("2026-12");
  expect(mocks.createAiClient).toHaveBeenCalledWith(expect.anything(), {
    timeoutMs: MONTH_PLAN_REQUEST_TIMEOUT_MS,
  });
  expect(MONTH_PLAN_REQUEST_TIMEOUT_MS).toBeGreaterThan(60000);
  expect(MONTH_PLAN_REQUEST_TIMEOUT_MS * 2).toBeLessThanOrEqual(240000);
});
