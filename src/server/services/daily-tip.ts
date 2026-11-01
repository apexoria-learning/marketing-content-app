import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../db/database.types";
import { DailyTipSchema } from "../../lib/schemas/content";
import { shiftDate } from "../../lib/utils/dates";
import { generateDailyTip } from "../ai/generators/daily-tip";
import { AiOutputError } from "../ai/validation";
import { AiTransportError, type AiRequest } from "../ai/client";

export async function ensureDailyTip(
  client: SupabaseClient<Database>,
  date: string,
  generate: (
    request: AiRequest,
    signal?: AbortSignal,
  ) => Promise<{ content: string }>,
  signal?: AbortSignal,
) {
  z.iso.date().parse(date);
  const { data, error } = await client
    .from("daily_tips")
    .select("*")
    .lte("tip_date", date)
    .order("tip_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const previous = data ? DailyTipSchema.parse(data) : null;
  if (previous?.tip_date === date)
    return { status: "existing" as const, tip: previous };
  const { data: recent, error: recentError } = await client
    .from("daily_tips")
    .select("tip")
    .gte("tip_date", shiftDate(date, -30))
    .lt("tip_date", date)
    .order("tip_date", { ascending: false })
    .limit(30);
  if (recentError) throw recentError;
  const recentTips = z
    .array(z.object({ tip: z.string() }))
    .parse(recent)
    .map((row) => row.tip);
  let generated: Awaited<ReturnType<typeof generateDailyTip>>;
  try {
    generated = await generateDailyTip(recentTips, generate, signal);
  } catch (failure) {
    if (!(
      failure instanceof AiOutputError || failure instanceof AiTransportError
    ))
      throw failure;
    console.error("Daily tip generation failed; retaining the last saved tip.");
    return { status: "failed" as const, tip: previous };
  }
  const { data: saved, error: saveError } = await client
    .from("daily_tips")
    .insert({ tip_date: date, ...generated })
    .select("*")
    .single();
  if (saveError) {
    if (saveError.code !== "23505") throw saveError;
    const { data: concurrent, error: concurrentError } = await client
      .from("daily_tips")
      .select("*")
      .eq("tip_date", date)
      .single();
    if (concurrentError) throw concurrentError;
    return {
      status: "existing" as const,
      tip: DailyTipSchema.parse(concurrent),
    };
  }
  return { status: "generated" as const, tip: DailyTipSchema.parse(saved) };
}
