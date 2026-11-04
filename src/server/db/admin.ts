import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  AppSettingsRowSchema,
  AppUserSchema,
  PromptInstructionSchema,
  type AppSettingsRow,
  type AppSettingsUpdate,
  type AppUser,
  type PromptInstruction,
  type PromptScope,
} from "../../lib/schemas/admin";
import {
  AuthAccountSchema,
  type AuthAccount,
} from "../../lib/utils/user-directory";
import { UsageRunSchema, type UsageRun } from "../../lib/utils/usage-summary";
import type {
  PlatformInput,
  PlatformRecord,
} from "../../lib/schemas/platforms";
import type { PillarInput, PillarRecord } from "../../lib/schemas/pillars";
import {
  BusinessProfileRecordSchema,
  type BusinessProfile,
  type BusinessProfileRecord,
} from "../../lib/schemas/business-profile";
import { env } from "../config/env";
import type { Database, TablesUpdate } from "./database.types";
import { loadPillarCatalogue } from "./pillars";
import { loadPlatformCatalogue } from "./platforms";

// Approved, scoped service_role use (ARCHITECTURE.md §6.3): callers are admin
// services that only run after the server re-verified an admin session. The
// factory is deliberately private so no other module can obtain this client.
function createAdminServiceRoleClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

const PAGE_SIZE = 1000;
// Bounds a single admin read; the team is a handful of people (PRD §3).
const MAX_PAGES = 20;

async function readPages<T>(
  load: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await load(
      page * PAGE_SIZE,
      page * PAGE_SIZE + PAGE_SIZE - 1,
    );
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  console.warn("Admin read reached its page limit; results are truncated.");
  return rows;
}

export async function listAppUsers(): Promise<AppUser[]> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("app_users")
    .select("*")
    .order("email");
  if (error) throw error;
  return z.array(AppUserSchema).parse(data);
}

export async function findAppUser(email: string): Promise<AppUser | null> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("app_users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data ? AppUserSchema.parse(data) : null;
}

export async function insertAppUser(
  row: Pick<AppUser, "email" | "role" | "is_active" | "can_generate">,
  actorEmail: string,
): Promise<AppUser> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("app_users")
    .insert({ ...row, created_by: actorEmail, updated_by: actorEmail })
    .select("*")
    .single();
  if (error) throw error;
  return AppUserSchema.parse(data);
}

export async function updateAppUser(
  email: string,
  changes: Partial<Pick<AppUser, "role" | "is_active" | "can_generate">>,
  actorEmail: string,
): Promise<AppUser | null> {
  const client = createAdminServiceRoleClient();
  const update: TablesUpdate<"app_users"> = { updated_by: actorEmail };
  if (changes.role !== undefined) update.role = changes.role;
  if (changes.is_active !== undefined) update.is_active = changes.is_active;
  if (changes.can_generate !== undefined)
    update.can_generate = changes.can_generate;
  const { data, error } = await client
    .from("app_users")
    .update(update)
    .eq("email", email)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? AppUserSchema.parse(data) : null;
}

/** Inserts members for emails without a row; existing rows are untouched. */
export async function insertMissingMembers(
  emails: readonly string[],
  actorEmail: string,
): Promise<number> {
  if (!emails.length) return 0;
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("app_users")
    .upsert(
      emails.map((email) => ({
        email,
        role: "member",
        is_active: true,
        can_generate: true,
        created_by: actorEmail,
        updated_by: actorEmail,
      })),
      { onConflict: "email", ignoreDuplicates: true },
    )
    .select("email");
  if (error) throw error;
  return z.array(z.object({ email: z.string() })).parse(data).length;
}

/** Every Google account that has completed sign-in, allowed or not. */
export async function listAuthAccounts(): Promise<AuthAccount[]> {
  const client = createAdminServiceRoleClient();
  const accounts: AuthAccount[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw error;
    for (const user of data.users) {
      if (!user.email) continue;
      const metadata = z
        .object({
          full_name: z.string().optional().catch(undefined),
          name: z.string().optional().catch(undefined),
        })
        .catch({})
        .parse(user.user_metadata ?? {});
      accounts.push(
        AuthAccountSchema.parse({
          email: user.email.toLowerCase(),
          name: (metadata.full_name ?? metadata.name)?.trim() || null,
          created_at: user.created_at ?? null,
          last_sign_in_at: user.last_sign_in_at ?? null,
        }),
      );
    }
    if (data.users.length < PAGE_SIZE) return accounts;
  }
  console.warn(
    "Account listing reached its page limit; results are truncated.",
  );
  return accounts;
}

export async function getSettingsOverrides(): Promise<AppSettingsRow> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return AppSettingsRowSchema.parse(data);
}

export async function updateSettingsOverrides(
  changes: AppSettingsUpdate,
  actorEmail: string,
): Promise<{ updated_at: string }> {
  const client = createAdminServiceRoleClient();
  const update: TablesUpdate<"app_settings"> = { updated_by: actorEmail };
  // Fields are picked explicitly; a validated object is never spread into a
  // write (API.md §2.4). Platform and pillar enablement live in their
  // catalogues (§5.12, §5.14).
  for (const field of [
    "ai_generation_enabled",
    "regen_daily_limit",
    "global_daily_ai_limit",
    "plan_day_of_month",
    "planning_horizon_months",
    "ai_model",
    "ai_base_url",
    "news_feed_urls",
  ] as const) {
    const value = changes[field];
    if (value !== undefined) Object.assign(update, { [field]: value });
  }
  const { data, error } = await client
    .from("app_settings")
    .update(update)
    .eq("id", 1)
    .select("updated_at")
    .single();
  if (error) throw error;
  return z.object({ updated_at: z.string().min(1) }).parse(data);
}

export async function listPromptInstructions(): Promise<PromptInstruction[]> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("prompt_instructions")
    .select("*")
    .order("id", { ascending: false })
    .limit(300);
  if (error) throw error;
  return z.array(PromptInstructionSchema).parse(data);
}

export async function insertPromptInstruction(
  scope: PromptScope,
  instructions: string,
  actorEmail: string,
): Promise<PromptInstruction> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("prompt_instructions")
    .insert({ scope, instructions, created_by: actorEmail })
    .select("*")
    .single();
  if (error) throw error;
  return PromptInstructionSchema.parse(data);
}

export async function listUsageRuns(since: string): Promise<UsageRun[]> {
  const client = createAdminServiceRoleClient();
  return readPages(async (from, to) => {
    const { data, error } = await client
      .from("generation_runs")
      .select("started_at,kind,status,input_tokens,output_tokens,actor_email")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return z.array(UsageRunSchema).parse(data);
  });
}

export async function listActivityActors(since: string) {
  const client = createAdminServiceRoleClient();
  return readPages(async (from, to) => {
    const { data, error } = await client
      .from("activity_log")
      .select("actor_email,created_at")
      .gte("created_at", since)
      .not("actor_email", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return z
      .array(
        z.object({
          actor_email: z.string().nullable(),
          created_at: z.string(),
        }),
      )
      .parse(data);
  });
}

/** Today's shared AI allowance consumption (DATABASE.md §5.8). */
export async function getGlobalAllowanceUsed(windowStart: string) {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("rate_limits")
    .select("count")
    .eq("actor_key", "global")
    .eq("action_key", "ai_generate")
    .eq("window_start", windowStart)
    .maybeSingle();
  if (error) throw error;
  return data ? z.number().int().nonnegative().parse(data.count) : 0;
}

export async function listPlatforms(): Promise<PlatformRecord[]> {
  return loadPlatformCatalogue(createAdminServiceRoleClient());
}

/** Writes the platform row and its formats in one transaction (0016). */
export async function savePlatform(
  platform: PlatformInput,
  create: boolean,
  actorEmail: string,
): Promise<{ key: string }> {
  const client = createAdminServiceRoleClient();
  const { formats, ...fields } = platform;
  const { data, error } = await client.rpc("save_platform", {
    p_platform: {
      key: fields.key,
      label: fields.label,
      is_enabled: fields.is_enabled,
      colour_slot: fields.colour_slot,
      icon: fields.icon,
      allows_hashtags: fields.allows_hashtags,
      max_hashtags: fields.allows_hashtags ? fields.max_hashtags : 0,
      caption_max_chars: fields.caption_max_chars,
      tone: fields.tone,
      guidance: fields.guidance,
    },
    p_formats: formats,
    p_create: create,
    p_actor: actorEmail,
  });
  if (error) throw error;
  return z.object({ key: z.string() }).parse(data);
}

export async function setPlatformSortOrder(
  key: string,
  sortOrder: number,
  actorEmail: string,
): Promise<void> {
  const client = createAdminServiceRoleClient();
  const { error } = await client
    .from("platforms")
    .update({ sort_order: sortOrder, updated_by: actorEmail })
    .eq("key", key);
  if (error) throw error;
}

export async function listPillars(): Promise<PillarRecord[]> {
  return loadPillarCatalogue(createAdminServiceRoleClient());
}

/** Writes the pillar and re-checks plannability in one transaction (0017). */
export async function savePillar(
  pillar: PillarInput,
  create: boolean,
  actorEmail: string,
): Promise<{ key: string }> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client.rpc("save_pillar", {
    p_pillar: {
      key: pillar.key,
      label: pillar.label,
      description: pillar.description,
      guidance: pillar.guidance,
      requires_news: pillar.requires_news,
      is_enabled: pillar.is_enabled,
    },
    p_create: create,
    p_actor: actorEmail,
  });
  if (error) throw error;
  return z.object({ key: z.string() }).parse(data);
}

export async function setPillarSortOrder(
  key: string,
  sortOrder: number,
  actorEmail: string,
): Promise<void> {
  const client = createAdminServiceRoleClient();
  const { error } = await client
    .from("pillars")
    .update({ sort_order: sortOrder, updated_by: actorEmail })
    .eq("key", key);
  if (error) throw error;
}

// Admin-only since 0018 (members lost their UPDATE policy).
export async function getBusinessProfile(): Promise<BusinessProfileRecord> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("brand_profile")
    .select(
      "business_name,industry,business_description,audience_description,offerings_label,courses,current_offers,tip_topic,do_list,dont_list,links,updated_at,updated_by",
    )
    .eq("id", 1)
    .single();
  if (error) throw error;
  return BusinessProfileRecordSchema.parse(data);
}

/** Replaces every editable profile field; tone lives on platforms (0016). */
export async function updateBusinessProfile(
  profile: BusinessProfile,
  actorEmail: string,
): Promise<{ updated_at: string }> {
  const client = createAdminServiceRoleClient();
  const { data, error } = await client
    .from("brand_profile")
    .update({
      business_name: profile.business_name,
      industry: profile.industry,
      business_description: profile.business_description,
      audience_description: profile.audience_description,
      offerings_label: profile.offerings_label,
      courses: profile.offerings,
      current_offers: profile.current_offers,
      tip_topic: profile.tip_topic,
      do_list: profile.do_list,
      dont_list: profile.dont_list,
      links: Object.fromEntries(
        profile.links.map((link) => [link.label, link.url]),
      ),
      updated_by: actorEmail,
    })
    .eq("id", 1)
    .select("updated_at")
    .single();
  if (error) throw error;
  return z.object({ updated_at: z.string().min(1) }).parse(data);
}
