import "server-only";
import { z } from "zod";
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
    ...(input.skipReason !== undefined
      ? { p_skip_reason: input.skipReason }
      : {}),
    ...(input.note !== undefined ? { p_note: input.note } : {}),
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
