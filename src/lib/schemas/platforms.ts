import { z } from "zod";
import { FormatSchema, PLATFORM_KEY_PATTERN, PlatformSchema } from "./content";

// Admin-managed platform catalogue (DATABASE.md §5.12–5.13). Keys are stable
// identifiers stored on content; everything else is editable.

export { PLATFORM_KEY_PATTERN };

export const PlatformKeySchema = PlatformSchema;

/** Pre-approved, contrast-tested colour tokens (DESIGN.md §3.2). */
export const PLATFORM_COLOUR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const ColourSlotSchema = z.number().int().min(1).max(8);

/** Platform glyphs available in the icon set (DESIGN.md §5.5). */
export const PLATFORM_ICONS = [
  "platform",
  "instagram",
  "linkedin",
  "whatsapp",
  "globe",
  "video",
  "chat",
  "briefcase",
  "megaphone",
] as const;
export const PlatformIconSchema = z.enum(PLATFORM_ICONS);
export type PlatformIcon = z.infer<typeof PlatformIconSchema>;

export function toPlatformIcon(icon: string): PlatformIcon {
  const parsed = PlatformIconSchema.safeParse(icon);
  return parsed.success ? parsed.data : "platform";
}

export const PlatformRecordSchema = z.object({
  key: PlatformKeySchema,
  label: z.string().min(1),
  is_enabled: z.boolean(),
  sort_order: z.number().int(),
  colour_slot: z.number().int(),
  icon: z.string(),
  allows_hashtags: z.boolean(),
  max_hashtags: z.number().int().nonnegative(),
  caption_max_chars: z.number().int().positive().nullable(),
  tone: z.string(),
  guidance: z.string(),
  formats: z.array(FormatSchema),
  updated_at: z.string(),
  updated_by: z.string().nullable(),
});
export type PlatformRecord = z.infer<typeof PlatformRecordSchema>;

/** The display fields every screen needs; safe to send to the browser. */
export const PlatformDisplaySchema = PlatformRecordSchema.pick({
  key: true,
  label: true,
  is_enabled: true,
  colour_slot: true,
  icon: true,
});
export type PlatformDisplay = z.infer<typeof PlatformDisplaySchema>;

export function toPlatformDisplay(record: PlatformRecord): PlatformDisplay {
  return {
    key: record.key,
    label: record.label,
    is_enabled: record.is_enabled,
    colour_slot: record.colour_slot,
    icon: record.icon,
  };
}

/** The per-platform rules the generators and validator need. */
export type PlatformRules = Pick<
  PlatformRecord,
  | "label"
  | "allows_hashtags"
  | "max_hashtags"
  | "caption_max_chars"
  | "guidance"
>;

const isUnique = (values: readonly string[]) =>
  new Set(values).size === values.length;

export const PlatformInputSchema = z
  .object({
    key: PlatformKeySchema,
    label: z.string().trim().min(1, "Enter a name.").max(40),
    is_enabled: z.boolean(),
    colour_slot: ColourSlotSchema,
    icon: PlatformIconSchema,
    formats: z
      .array(FormatSchema)
      .min(1, "Choose at least one format.")
      .max(FormatSchema.options.length)
      .refine(isUnique, "Each format may appear once."),
    allows_hashtags: z.boolean(),
    max_hashtags: z.number().int().min(0).max(30),
    caption_max_chars: z.number().int().min(50).max(10000).nullable(),
    tone: z.string().trim().max(2000),
    guidance: z.string().trim().max(1000),
  })
  .strict();
export type PlatformInput = z.infer<typeof PlatformInputSchema>;

export const SavePlatformInputSchema = z
  .object({
    mode: z.enum(["create", "update"]),
    platform: PlatformInputSchema,
  })
  .strict();
export type SavePlatformInput = z.infer<typeof SavePlatformInputSchema>;

export const MovePlatformInputSchema = z
  .object({
    key: PlatformKeySchema,
    direction: z.enum(["up", "down"]),
  })
  .strict();
export type MovePlatformInput = z.infer<typeof MovePlatformInputSchema>;

/**
 * Month planning forbids repeating a platform+format on consecutive days, so
 * at least two enabled platform/format pairs must remain (ARCHITECTURE.md §4.4).
 */
export function hasPlannablePlatforms(
  platforms: readonly Pick<PlatformRecord, "is_enabled" | "formats">[],
): boolean {
  return (
    platforms
      .filter((platform) => platform.is_enabled)
      .reduce((pairs, platform) => pairs + platform.formats.length, 0) >= 2
  );
}
