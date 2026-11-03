import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { FormatSchema } from "../../lib/schemas/content";
import {
  PlatformRecordSchema,
  type PlatformRecord,
} from "../../lib/schemas/platforms";
import type { PlanningFilters } from "../../lib/utils/planning-rules";
import { createUserDatabaseClient } from "./client";
import type { Database } from "./database.types";

const FormatRowSchema = z.object({
  platform_key: z.string(),
  format: FormatSchema,
});

/** Joins platform rows with their formats, in display order. */
export function buildPlatformCatalogue(
  platforms: unknown,
  formats: unknown,
): PlatformRecord[] {
  const formatRows = z.array(FormatRowSchema).parse(formats);
  return z
    .array(z.record(z.string(), z.unknown()))
    .parse(platforms)
    .map((row) =>
      PlatformRecordSchema.parse({
        ...row,
        formats: FormatSchema.options.filter((format) =>
          formatRows.some(
            (entry) =>
              entry.platform_key === row.key && entry.format === format,
          ),
        ),
      }),
    );
}

/** Reads the catalogue with any client; RLS lets every member read it. */
export async function loadPlatformCatalogue(
  client: SupabaseClient<Database>,
): Promise<PlatformRecord[]> {
  const [platforms, formats] = await Promise.all([
    client.from("platforms").select("*").order("sort_order").order("key"),
    client.from("platform_formats").select("platform_key,format"),
  ]);
  if (platforms.error) throw platforms.error;
  if (formats.error) throw formats.error;
  return buildPlatformCatalogue(platforms.data, formats.data);
}

// One read per request: layout, pages and generation share it.
export const getPlatformCatalogue = cache(async () =>
  loadPlatformCatalogue(await createUserDatabaseClient()),
);

export function planningPlatforms(
  catalogue: readonly PlatformRecord[],
): PlanningFilters["platforms"] {
  return catalogue
    .filter((platform) => platform.is_enabled && platform.formats.length)
    .map((platform) => ({ key: platform.key, formats: platform.formats }));
}
