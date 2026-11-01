import "server-only";
import Portkey from "portkey-ai";
import { z } from "zod";
import type { Env } from "../config/env-schema";

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
  max_tokens: z.number().int().positive().max(16384),
});

const CompletionSchema = z.object({
  choices: z.tuple([
    z.object({
      finish_reason: z.literal("stop"),
      message: z.object({
        content: z.string().trim().min(1),
        refusal: z.string().nullable().optional(),
      }),
    }),
  ]),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
  }),
});

export type AiRequest = z.infer<typeof RequestSchema>;

export class AiTransportError extends Error {
  constructor(
    readonly reason:
      "TIMEOUT" | "RATE_LIMITED" | "INVALID_OUTPUT" | "PROVIDER_ERROR",
  ) {
    super("Content generation could not be completed.");
    this.name = "AiTransportError";
  }
}

export const DEFAULT_AI_TIMEOUT_MS = 60000;

export function createAiClient(
  configuration: Pick<Env, "PORTKEY_API_KEY" | "PORTKEY_BASE_URL" | "AI_MODEL">,
  options: { timeoutMs?: number } = {},
) {
  // The SDK forwards requestTimeout as the gateway's per-request deadline, so
  // the gateway and the local abort share one bound below the 300s function cap.
  const timeoutMs = z
    .number()
    .int()
    .min(1000)
    .max(240000)
    .parse(options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS);
  const client = new Portkey({
    apiKey: configuration.PORTKEY_API_KEY,
    baseURL: configuration.PORTKEY_BASE_URL,
    requestTimeout: timeoutMs,
  });
  // Gateway retries must not multiply with SDK retries (API.md §8.1).
  client.maxRetries = 0;

  return async (input: AiRequest, signal?: AbortSignal) => {
    const request = RequestSchema.parse(input);
    const timeout = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const startedAt = performance.now();
    let response: unknown;

    try {
      response = await client.chat.completions.create(
        {
          ...request,
          model: configuration.AI_MODEL,
          response_format: { type: "json_object" },
          stream: false,
        },
        undefined,
        { signal: requestSignal },
      );
    } catch (error) {
      const status =
        error instanceof Error && "status" in error ? error.status : undefined;
      const reason =
        requestSignal.aborted || status === 408
          ? "TIMEOUT"
          : status === 429
            ? "RATE_LIMITED"
            : "PROVIDER_ERROR";
      console.error("AI request failed.", { reason, status });
      throw new AiTransportError(reason);
    }

    const parsed = CompletionSchema.safeParse(response);
    if (!parsed.success || parsed.data.choices[0].message.refusal) {
      console.error("AI response validation failed.");
      throw new AiTransportError("INVALID_OUTPUT");
    }
    const choice = parsed.data.choices[0];
    return {
      content: choice.message.content,
      input_tokens: parsed.data.usage.prompt_tokens,
      output_tokens: parsed.data.usage.completion_tokens,
      duration_ms: Math.round(performance.now() - startedAt),
    };
  };
}
