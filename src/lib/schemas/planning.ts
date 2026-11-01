import { z } from "zod";
import { FormatSchema, PillarSchema, PlatformSchema } from "./content";

export const PlannedSlotSchema = z
  .object({
    scheduled_date: z.iso.date(),
    slot: z.number().int().min(1).max(2),
    platform: PlatformSchema,
    format: FormatSchema,
    pillar: PillarSchema,
    // Skeleton slots carry a one-line idea (ARCHITECTURE.md §4.3); hooks and
    // per-slide copy belong to hydration and would bloat the whole-month reply.
    idea: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[^\r\n]+$/, "Must be a single line"),
  })
  .strict();

export const PlanOutputSchema = z
  .object({
    items: z.array(PlannedSlotSchema).min(1).max(62),
  })
  .strict();

export type PlannedSlot = z.infer<typeof PlannedSlotSchema>;

export const PlanMonthInputSchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .refine(
        (month) =>
          Number(month.slice(0, 4)) >= 2000 &&
          Number(month.slice(0, 4)) <= 2099,
      ),
  })
  .strict();

export const GenerateForDayInputSchema = z
  .object({
    date: z.iso.date(),
    count: z.number().int().min(1).max(2).default(1),
  })
  .strict();

export const HydrateItemInputSchema = z.object({ item_id: z.uuid() }).strict();
export const RegenerateItemInputSchema = HydrateItemInputSchema.extend({
  steer: z.string().trim().max(500).optional(),
}).strict();

export type PlanMonthInput = z.infer<typeof PlanMonthInputSchema>;
export type GenerateForDayInput = z.infer<typeof GenerateForDayInputSchema>;
export type HydrateItemInput = z.infer<typeof HydrateItemInputSchema>;
export type RegenerateItemInput = z.infer<typeof RegenerateItemInputSchema>;
