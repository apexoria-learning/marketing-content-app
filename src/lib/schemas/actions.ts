import { z } from "zod";

const itemId = z.uuid();

export const MarkPostedInputSchema = z
  .object({
    item_id: itemId,
    posted: z.boolean(),
    note: z.string().trim().max(280).optional(),
  })
  .strict();

export const SkipItemInputSchema = z
  .object({
    item_id: itemId,
    skipped: z.boolean(),
    reason: z.string().trim().max(280).optional(),
  })
  .strict();

export const AddNoteInputSchema = z
  .object({
    item_id: itemId,
    note: z.string().trim().min(1).max(280),
  })
  .strict();

export type MarkPostedInput = z.infer<typeof MarkPostedInputSchema>;
export type SkipItemInput = z.infer<typeof SkipItemInputSchema>;
export type AddNoteInput = z.infer<typeof AddNoteInputSchema>;
