import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  PillarRecordSchema,
  toPillarRules,
  type PillarRecord,
} from "../../lib/schemas/pillars";
import type { PlanningFilters } from "../../lib/utils/planning-rules";
import { createUserDatabaseClient } from "./client";
import type { Database } from "./database.types";

/** Parses pillar rows, keeping the database's display order. */
export function buildPillarCatalogue(rows: unknown): PillarRecord[] {
  return z.array(PillarRecordSchema).parse(rows);
}

/** Reads the catalogue with any client; RLS lets every member read it. */
export async function loadPillarCatalogue(
  client: SupabaseClient<Database>,
): Promise<PillarRecord[]> {
  const { data, error } = await client
    .from("pillars")
    .select(
      "key,label,description,guidance,requires_news,is_enabled,sort_order,updated_at,updated_by",
    )
    .order("sort_order")
    .order("key");
  if (error) throw error;
  return buildPillarCatalogue(data);
}

// One read per request: layout, pages and generation share it.
export const getPillarCatalogue = cache(async () =>
  loadPillarCatalogue(await createUserDatabaseClient()),
);

export function planningPillars(
  catalogue: readonly PillarRecord[],
): PlanningFilters["pillars"] {
  return catalogue
    .filter((pillar) => pillar.is_enabled)
    .map((pillar) => ({ key: pillar.key, ...toPillarRules(pillar) }));
}
