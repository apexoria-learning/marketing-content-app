import "server-only";
import { z } from "zod";
import type { BrandProfileUpdate } from "../../lib/schemas/brand-profile";
import { createUserDatabaseClient } from "./client";

const ContentStatusSchema = z.enum(["idea", "ready", "posted", "skipped"]);

const ChangedContentItemSchema = z.object({
  item: z.object({
    id: z.uuid(),
    scheduled_date: z.iso.date(),
    status: ContentStatusSchema,
    posted_at: z.string().nullable(),
  }),
  month_progress: z.object({
    posted: z.number().int().nonnegative(),
    planned: z.number().int().nonnegative(),
  }),
});

export type ChangedContentItem = z.infer<typeof ChangedContentItemSchema>;

export async function changeContentStatus(input: {
  itemId: string;
  status: z.infer<typeof ContentStatusSchema>;
  skipReason?: string;
  note?: string;
}): Promise<ChangedContentItem> {
  const supabase = await createUserDatabaseClient();
  const { data, error } = await supabase.rpc("change_content_status", {
    p_item_id: input.itemId,
    p_status: input.status,
    p_skip_reason: input.skipReason ?? null,
    p_note: input.note ?? null,
  });

  if (error) {
    throw error;
  }

  return ChangedContentItemSchema.parse(data);
}

export async function appendActivityNote(input: {
  itemId: string;
  actorEmail: string;
  note: string;
}): Promise<void> {
  const supabase = await createUserDatabaseClient();
  const { error } = await supabase.from("activity_log").insert({
    content_item_id: input.itemId,
    action: "note_added",
    actor_email: input.actorEmail,
    note: input.note,
  });

  if (error) {
    throw error;
  }
}

export async function updateBrandProfile(input: {
  fields: BrandProfileUpdate;
  actorEmail: string;
}): Promise<{ updated_at: string }> {
  const supabase = await createUserDatabaseClient();
  const changes: {
    business_name?: string;
    business_description?: string;
    audience_description?: string;
    courses?: string[];
    current_offers?: string | null;
    tone_instagram?: string;
    tone_linkedin?: string;
    tone_whatsapp?: string;
    do_list?: string[];
    dont_list?: string[];
    links?: Record<string, string>;
    updated_by: string;
  } = { updated_by: input.actorEmail };

  for (const field of [
    "business_name",
    "business_description",
    "audience_description",
    "courses",
    "current_offers",
    "tone_instagram",
    "tone_linkedin",
    "tone_whatsapp",
    "do_list",
    "dont_list",
    "links",
  ] as const) {
    const value = input.fields[field];

    if (value !== undefined) {
      Object.assign(changes, { [field]: value });
    }
  }

  const { data, error } = await supabase
    .from("brand_profile")
    .update(changes)
    .eq("id", 1)
    .select("updated_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return z.object({ updated_at: z.string().min(1) }).parse(data);
}
