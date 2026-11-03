import { z } from "zod";
import { PillarSchema } from "./content";

// Admin-managed pillar catalogue (DATABASE.md §5.14). Keys are stable
// identifiers stored on content and in pillar history; the rest is editable.

export const PillarKeySchema = PillarSchema;

/** Enabled pillars that do not need news keep planning satisfiable (§4.4). */
export const MIN_TOPIC_PILLARS = 3;
/** Each enabled pillar must fit twice into February at one item per day. */
export const MAX_ENABLED_PILLARS = 14;

export const PillarRecordSchema = z.object({
  key: PillarKeySchema,
  label: z.string().min(1),
  description: z.string().min(1),
  guidance: z.string(),
  requires_news: z.boolean(),
  is_enabled: z.boolean(),
  sort_order: z.number().int(),
  updated_at: z.string(),
  updated_by: z.string().nullable(),
});
export type PillarRecord = z.infer<typeof PillarRecordSchema>;

/** The display fields every screen needs; safe to send to the browser. */
export const PillarDisplaySchema = PillarRecordSchema.pick({
  key: true,
  label: true,
  is_enabled: true,
  requires_news: true,
});
export type PillarDisplay = z.infer<typeof PillarDisplaySchema>;

export function toPillarDisplay(record: PillarRecord): PillarDisplay {
  return {
    key: record.key,
    label: record.label,
    is_enabled: record.is_enabled,
    requires_news: record.requires_news,
  };
}

/** Unknown keys (e.g. an unreadable catalogue) still render readably. */
export function pillarDisplayFor(
  catalogue: readonly PillarDisplay[],
  key: string,
): PillarDisplay {
  return (
    catalogue.find((pillar) => pillar.key === key) ?? {
      key,
      label: key.replaceAll("_", " "),
      is_enabled: false,
      requires_news: false,
    }
  );
}

/** The per-pillar rules the planners, generators and validator need. */
export type PillarRules = Pick<
  PillarRecord,
  "label" | "description" | "guidance" | "requires_news"
>;

export function toPillarRules(record: PillarRules): PillarRules {
  return {
    label: record.label,
    description: record.description,
    guidance: record.guidance,
    requires_news: record.requires_news,
  };
}

export const PillarInputSchema = z
  .object({
    key: PillarKeySchema,
    label: z.string().trim().min(1, "Enter a name.").max(30),
    description: z
      .string()
      .trim()
      .min(1, "Describe what this pillar is for.")
      .max(300),
    guidance: z.string().trim().max(1000),
    requires_news: z.boolean(),
    is_enabled: z.boolean(),
  })
  .strict();
export type PillarInput = z.infer<typeof PillarInputSchema>;

export const SavePillarInputSchema = z
  .object({
    mode: z.enum(["create", "update"]),
    pillar: PillarInputSchema,
  })
  .strict();
export type SavePillarInput = z.infer<typeof SavePillarInputSchema>;

export const MovePillarInputSchema = z
  .object({
    key: PillarKeySchema,
    direction: z.enum(["up", "down"]),
  })
  .strict();
export type MovePillarInput = z.infer<typeof MovePillarInputSchema>;

/**
 * Plannability (ARCHITECTURE.md §4.4): planning without news needs at least
 * three topic pillars to avoid adjacent-day repeats, and every enabled pillar
 * must fit twice into the shortest month. Mirrors `save_pillar`.
 */
export function pillarPlannabilityError(
  pillars: readonly Pick<PillarRecord, "is_enabled" | "requires_news">[],
): string | null {
  const enabled = pillars.filter((pillar) => pillar.is_enabled);
  if (
    enabled.filter((pillar) => !pillar.requires_news).length < MIN_TOPIC_PILLARS
  )
    return `Keep at least ${MIN_TOPIC_PILLARS} enabled pillars that do not need news.`;
  if (enabled.length > MAX_ENABLED_PILLARS)
    return `Enable at most ${MAX_ENABLED_PILLARS} pillars.`;
  return null;
}
