import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GenerationContextSchema } from "../ai/schemas";
import type { Database } from "../db/database.types";
import type { PlannedSlot } from "../../lib/schemas/planning";
import { shiftDate } from "../../lib/utils/dates";

export async function loadGenerationContext(
  client: SupabaseClient<Database>,
  slot: Pick<PlannedSlot, "platform" | "format" | "pillar" | "idea">,
  today: string,
  steer?: string,
) {
  const [brandResult, newsResult, recentResult, historyResult] =
    await Promise.all([
      client.from("brand_profile").select("*").eq("id", 1).single(),
      client
        .from("news_items")
        .select("title,url,source,summary")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(20),
      client
        .from("content_items")
        .select("idea")
        .eq("status", "posted")
        .gte("posted_at", `${shiftDate(today, -60)}T00:00:00+05:30`)
        .order("posted_at", { ascending: false })
        .limit(120),
      client
        .from("content_items")
        .select("pillar")
        .gte("scheduled_date", shiftDate(today, -60))
        .lt("scheduled_date", today)
        .order("scheduled_date", { ascending: false })
        .limit(120),
    ]);
  for (const result of [brandResult, newsResult, recentResult, historyResult])
    if (result.error) throw result.error;
  const brand = z
    .object({
      business_name: z.string(),
      business_description: z.string(),
      audience_description: z.string(),
      courses: z.array(z.string()),
      current_offers: z.string().nullable(),
      tone_instagram: z.string(),
      tone_linkedin: z.string(),
      tone_whatsapp: z.string(),
      do_list: z.array(z.string()),
      dont_list: z.array(z.string()),
      links: z.record(z.string(), z.url()),
    })
    .parse(brandResult.data);
  return GenerationContextSchema.parse({
    ...slot,
    brand: {
      business_name: brand.business_name,
      business_description: brand.business_description,
      audience_description: brand.audience_description,
      courses: brand.courses,
      current_offers: brand.current_offers,
      tone: brand[`tone_${slot.platform}`],
      do_list: brand.do_list,
      dont_list: brand.dont_list,
      links: brand.links,
    },
    news: newsResult.data,
    recent_ideas: z
      .array(z.object({ idea: z.string() }))
      .parse(recentResult.data)
      .map((item) => item.idea),
    pillar_history: z
      .array(z.object({ pillar: z.string() }))
      .parse(historyResult.data)
      .map((item) => item.pillar),
    ...(steer === undefined ? {} : { steer }),
  });
}
