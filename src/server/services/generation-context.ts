import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GenerationContextSchema, type GenerationContext } from "../ai/schemas";
import type { Database } from "../db/database.types";
import type { PlannedSlot } from "../../lib/schemas/planning";
import { shiftDate } from "../../lib/utils/dates";
import { ActionFailure } from "./service-error";

async function loadRecentIdeas(
  client: SupabaseClient<Database>,
  today: string,
) {
  const ideas: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("content_items")
      .select("idea")
      .eq("status", "posted")
      .gte("posted_at", `${shiftDate(today, -60)}T00:00:00+05:30`)
      .order("posted_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 499);
    if (error) throw error;
    const rows = z.array(z.object({ idea: z.string() })).parse(data);
    ideas.push(...rows.map((row) => row.idea));
    if (rows.length < 500) return ideas;
  }
}

export async function loadGenerationContext(
  client: SupabaseClient<Database>,
  slot: Pick<PlannedSlot, "platform" | "format" | "pillar" | "idea">,
  today: string,
  steer?: string,
  instructions?: GenerationContext["instructions"],
) {
  const [brandResult, platformResult, newsResult, recentResult, historyResult] =
    await Promise.all([
      client.from("brand_profile").select("*").eq("id", 1).single(),
      client
        .from("platforms")
        .select(
          "label,allows_hashtags,max_hashtags,caption_max_chars,guidance,tone",
        )
        .eq("key", slot.platform)
        .maybeSingle(),
      client
        .from("news_items")
        .select("title,url,source,summary")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(20),
      loadRecentIdeas(client, today),
      client
        .from("content_items")
        .select("pillar")
        .gte("scheduled_date", shiftDate(today, -60))
        .lt("scheduled_date", today)
        .order("scheduled_date", { ascending: false })
        .limit(120),
    ]);
  for (const result of [brandResult, platformResult, newsResult, historyResult])
    if (result.error) throw result.error;
  const brand = z
    .object({
      business_name: z.string(),
      business_description: z.string(),
      audience_description: z.string(),
      courses: z.array(z.string()),
      current_offers: z.string().nullable(),
      do_list: z.array(z.string()),
      dont_list: z.array(z.string()),
      links: z.record(z.string(), z.url()),
    })
    .parse(brandResult.data);
  if (!platformResult.data)
    throw new ActionFailure(
      "VALIDATION",
      "Platform is not in the catalogue.",
      "This platform no longer exists. Nothing was changed.",
    );
  const { tone, ...platformRules } = platformResult.data;
  return GenerationContextSchema.parse({
    // Pick explicitly: callers may pass a whole content item, and the strict
    // context schema rejects any extra field (id, status, hook, ...).
    platform: slot.platform,
    format: slot.format,
    pillar: slot.pillar,
    idea: slot.idea,
    brand: {
      business_name: brand.business_name,
      business_description: brand.business_description,
      audience_description: brand.audience_description,
      courses: brand.courses,
      current_offers: brand.current_offers,
      // Per-platform tone now lives on the catalogue row (DATABASE.md §5.12).
      tone: tone || "Match the brand voice described above.",
      do_list: brand.do_list,
      dont_list: brand.dont_list,
      links: brand.links,
    },
    platform_rules: platformRules,
    news: newsResult.data,
    recent_ideas: recentResult,
    pillar_history: z
      .array(z.object({ pillar: z.string() }))
      .parse(historyResult.data)
      .map((item) => item.pillar),
    ...(steer === undefined ? {} : { steer }),
    ...(instructions === undefined ? {} : { instructions }),
  });
}
