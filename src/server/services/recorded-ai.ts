import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";
import type { AiRequest } from "../ai/client";
import { estimateCost, type TokenPricing } from "../ai/accounting";

export function createRecordedAiClient(
  database: SupabaseClient<Database>,
  generate: (
    input: AiRequest,
    signal?: AbortSignal,
  ) => Promise<{
    content: string;
    input_tokens: number;
    output_tokens: number;
    duration_ms: number;
  }>,
  metadata: {
    kind: "item_hydration" | "item_regeneration";
    content_item_id: string;
    model: string;
    prompt_version: string;
  },
  pricing: TokenPricing | null,
) {
  // Verify pricing before opening a run or making a paid call.
  if (pricing !== null) estimateCost(0, 0, pricing);
  return async (input: AiRequest, signal?: AbortSignal) => {
    const { data, error } = await database
      .from("generation_runs")
      .insert({ ...metadata, started_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    const { id } = z.object({ id: z.number().int().positive() }).parse(data);
    let output: Awaited<ReturnType<typeof generate>>;
    let cost: string | null;
    try {
      output = await generate(input, signal);
      cost =
        pricing === null
          ? null
          : estimateCost(output.input_tokens, output.output_tokens, pricing);
    } catch (failure) {
      console.error("Recorded AI request failed.");
      const { error: loggingError } = await database
        .from("generation_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: "Content generation request failed.",
        })
        .eq("id", id);
      if (loggingError) {
        console.error("AI failure telemetry could not be saved.", {
          runId: id,
        });
        throw loggingError;
      }
      throw failure;
    }
    const { error: finishError } = await database
      .from("generation_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        input_tokens: output.input_tokens,
        output_tokens: output.output_tokens,
        estimated_cost_usd: cost === null ? null : Number(cost),
      })
      .eq("id", id);
    if (finishError) {
      console.error("AI success telemetry could not be saved.", { runId: id });
      throw finishError;
    }
    return output;
  };
}
