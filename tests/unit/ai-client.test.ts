import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  instances: [] as { maxRetries: number }[],
  options: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("portkey-ai", () => ({
  default: class {
    maxRetries = 1;
    chat = { completions: { create: mocks.create } };
    constructor(options: unknown) {
      mocks.options(options);
      mocks.instances.push(this);
    }
  },
}));

import { createAiClient } from "../../src/server/ai/client";

const configuration = {
  PORTKEY_API_KEY: "mock-key-not-a-real-credential",
  PORTKEY_BASE_URL: "https://gateway.example.test/v1",
  AI_MODEL: "@dsvertex/anthropic.claude-sonnet-5-5",
};
const request = {
  messages: [{ role: "user" as const, content: "Generate a JSON item." }],
  max_tokens: 512,
};
const completion = {
  choices: [
    { finish_reason: "stop", message: { content: '{"hook":"Example"}' } },
  ],
  usage: { prompt_tokens: 32, completion_tokens: 12 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.instances.length = 0;
  mocks.create.mockResolvedValue(completion);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("AI gateway transport", () => {
  it("uses the authorized endpoint and alias without virtual-key/config routing or SDK retries", async () => {
    const generate = createAiClient(configuration);
    const result = await generate(request);

    expect(mocks.options).toHaveBeenCalledWith({
      apiKey: configuration.PORTKEY_API_KEY,
      baseURL: configuration.PORTKEY_BASE_URL,
      requestTimeout: 60000,
    });
    expect(mocks.instances[0]?.maxRetries).toBe(0);
    expect(mocks.create).toHaveBeenCalledWith(
      {
        ...request,
        model: configuration.AI_MODEL,
        response_format: { type: "json_object" },
        stream: false,
      },
      undefined,
      { signal: expect.any(AbortSignal) },
    );
    expect(result).toEqual({
      content: '{"hook":"Example"}',
      input_tokens: 32,
      output_tokens: 12,
      duration_ms: expect.any(Number),
    });
  });

  it("rejects invalid token limits before making a request", async () => {
    await expect(
      createAiClient(configuration)({ ...request, max_tokens: 0 }),
    ).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    { ...completion, usage: {} },
    { ...completion, choices: [] },
    {
      ...completion,
      choices: [{ finish_reason: "length", message: { content: "{}" } }],
    },
    {
      ...completion,
      choices: [{ finish_reason: "stop", message: { content: "  " } }],
    },
    {
      ...completion,
      choices: [
        {
          finish_reason: "stop",
          message: { content: "{}", refusal: "Refused" },
        },
      ],
    },
  ])("rejects incomplete, unaccounted or refused output", async (response) => {
    mocks.create.mockResolvedValue(response);
    await expect(createAiClient(configuration)(request)).rejects.toMatchObject({
      reason: "INVALID_OUTPUT",
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("classifies a gateway rate limit without leaking its message or retrying", async () => {
    mocks.create.mockRejectedValue(
      Object.assign(new Error("sensitive provider response"), { status: 429 }),
    );
    await expect(createAiClient(configuration)(request)).rejects.toMatchObject({
      reason: "RATE_LIMITED",
      message: "Content generation could not be completed.",
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "sensitive provider response",
    );
  });
});
