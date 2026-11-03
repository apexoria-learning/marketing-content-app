import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAiClient: vi.fn(),
  generateItem: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({
  env: { PORTKEY_API_KEY: "server-held-key" },
}));
vi.mock("../../src/server/db/settings", () => ({
  loadRuntimeConfig: async () => ({
    aiModel: "@admin/model",
    aiBaseUrl: "https://gateway.example.test/v1",
    planningHorizonMonths: 2,
  }),
  getRuntimeConfig: vi.fn(),
  getActiveInstructions: async () => null,
}));
vi.mock("../../src/server/db/client", () => ({
  createUserDatabaseClient: async () => ({}),
}));
vi.mock("../../src/server/db/queries", () => ({ getItem: vi.fn() }));
vi.mock("../../src/server/security", () => ({
  consumeGenerationBudget: vi.fn(),
}));
vi.mock("../../src/server/ai/client", () => ({
  createAiClient: mocks.createAiClient,
}));
vi.mock("../../src/server/services/item-generation", () => ({
  generateItem: mocks.generateItem,
}));

import { generateContentItemWithClient } from "../../src/server/services/content-generation";
import {
  CONTENT_GENERATION_BUDGET_MS,
  CONTENT_REQUEST_TIMEOUT_MS,
} from "../../src/server/ai/prompts";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAiClient.mockReturnValue(vi.fn());
  mocks.generateItem.mockResolvedValue({});
});

it("bounds each item request and every repair under one 240s budget", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout");
  try {
    await generateContentItemWithClient(
      {} as never,
      "c862f630-7968-4b35-b048-9b7e9183fef1",
      false,
    );
    expect(mocks.createAiClient).toHaveBeenCalledWith(expect.anything(), {
      timeoutMs: CONTENT_REQUEST_TIMEOUT_MS,
    });
    expect(timeout).toHaveBeenCalledWith(CONTENT_GENERATION_BUDGET_MS);
    expect(mocks.generateItem.mock.calls[0]?.[2]).toBeInstanceOf(AbortSignal);
    expect(CONTENT_REQUEST_TIMEOUT_MS).toBeGreaterThan(60000);
    expect(CONTENT_GENERATION_BUDGET_MS).toBeLessThanOrEqual(240000);
  } finally {
    timeout.mockRestore();
  }
});

it("honours an earlier caller deadline, such as the batch's remaining time", async () => {
  const caller = new AbortController();
  await generateContentItemWithClient(
    {} as never,
    "c862f630-7968-4b35-b048-9b7e9183fef1",
    false,
    undefined,
    caller.signal,
  );
  const combined = mocks.generateItem.mock.calls[0]?.[2] as AbortSignal;
  expect(combined.aborted).toBe(false);
  caller.abort();
  expect(combined.aborted).toBe(true);
});

it("routes through the admin-configured gateway with the server-held key", async () => {
  await generateContentItemWithClient(
    {} as never,
    "c862f630-7968-4b35-b048-9b7e9183fef1",
    false,
  );
  expect(mocks.createAiClient).toHaveBeenCalledWith(
    {
      PORTKEY_API_KEY: "server-held-key",
      PORTKEY_BASE_URL: "https://gateway.example.test/v1",
      AI_MODEL: "@admin/model",
    },
    { timeoutMs: CONTENT_REQUEST_TIMEOUT_MS },
  );
});
