import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  AppSettingsRowSchema,
  type PromptScope,
} from "../../lib/schemas/admin";
import { env } from "../config/env";
import { resolveRuntimeConfig, type RuntimeConfig } from "../config/runtime";
import { createUserDatabaseClient } from "./client";
import type { Database } from "./database.types";

export async function loadRuntimeConfig(
  client: SupabaseClient<Database>,
): Promise<RuntimeConfig> {
  const { data, error } = await client
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return resolveRuntimeConfig(
    env,
    data ? AppSettingsRowSchema.parse(data) : null,
  );
}

// One read per request: pages, budget checks and generation share it.
export const getRuntimeConfig = cache(async () =>
  loadRuntimeConfig(await createUserDatabaseClient()),
);

export type ActiveInstructions = { version: number; text: string };

/** The latest version per scope is active; an empty version clears it. */
export async function getActiveInstructions(
  client: SupabaseClient<Database>,
  scope: PromptScope,
): Promise<ActiveInstructions | null> {
  const { data, error } = await client
    .from("prompt_instructions")
    .select("id,instructions")
    .eq("scope", scope)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = z
    .object({ id: z.number().int().positive(), instructions: z.string() })
    .parse(data);
  return row.instructions ? { version: row.id, text: row.instructions } : null;
}
