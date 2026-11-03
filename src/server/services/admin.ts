import "server-only";
import type { AdminActor } from "../auth";
import { env } from "../config/env";
import {
  resolveRuntimeConfig,
  runtimeDefaults,
  type RuntimeConfig,
} from "../config/runtime";
import {
  findAppUser,
  getGlobalAllowanceUsed,
  getSettingsOverrides,
  insertAppUser,
  insertMissingMembers,
  insertPromptInstruction,
  listActivityActors,
  listAppUsers,
  listAuthAccounts,
  listPromptInstructions,
  listUsageRuns,
  updateAppUser,
  updateSettingsOverrides,
} from "../db/admin";
import { isEmailListed, parseEmailList } from "../../lib/auth/allowlist";
import {
  type AppSettingsRow,
  type AppSettingsUpdate,
  type GrantAccessInput,
  type PromptInstruction,
  type PromptScope,
  type SaveInstructionsInput,
  type UpdateAccessInput,
} from "../../lib/schemas/admin";
import { todayInIst } from "../../lib/utils/dates";
import {
  summarizeUsage,
  usageWindowStart,
  type UsageSummary,
} from "../../lib/utils/usage-summary";
import {
  buildUserDirectory,
  summarizeUserBase,
  type DirectoryEntry,
  type UserBaseSummary,
} from "../../lib/utils/user-directory";
import { ActionFailure } from "./service-error";

// Every export takes an AdminActor, which only toAdminActor can produce
// after a verified admin session (ARCHITECTURE.md §6.3).
function assertAdmin(admin: AdminActor): void {
  // Runtime backstop for the compile-time token; reaching here without one
  // is a programming error, never a user state.
  if (!admin?.email) throw new Error("Admin actor is required.");
}

async function loadDirectory(now: Date) {
  const since = usageWindowStart(now);
  const [records, accounts, runs, activity] = await Promise.all([
    listAppUsers(),
    listAuthAccounts(),
    listUsageRuns(since),
    listActivityActors(since),
  ]);
  return {
    runs,
    entries: buildUserDirectory({
      ownerEmails: env.ADMIN_EMAILS,
      allowedEmails: env.ALLOWED_EMAILS,
      records,
      accounts,
      runs,
      activity,
    }),
  };
}

export type AdminOverview = {
  users: UserBaseSummary;
  usage: UsageSummary;
  names: Record<string, string>;
  allowance: { used: number; limit: number; per_user: number };
  config: Pick<
    RuntimeConfig,
    | "aiGenerationEnabled"
    | "aiModel"
    | "planningHorizonMonths"
    | "enabledPlatforms"
    | "enabledPillars"
  >;
};

export async function getAdminOverview(
  admin: AdminActor,
  now = new Date(),
): Promise<AdminOverview> {
  assertAdmin(admin);
  const [{ runs, entries }, overrides, used] = await Promise.all([
    loadDirectory(now),
    getSettingsOverrides(),
    getGlobalAllowanceUsed(`${todayInIst(now)}T00:00:00+05:30`),
  ]);
  const config = resolveRuntimeConfig(env, overrides);
  return {
    users: summarizeUserBase(entries, now),
    usage: summarizeUsage(runs, now),
    names: Object.fromEntries(
      entries.flatMap((entry) =>
        entry.name ? [[entry.email, entry.name] as const] : [],
      ),
    ),
    allowance: {
      used,
      limit: config.globalDailyAiLimit,
      per_user: config.regenDailyLimit,
    },
    config: {
      aiGenerationEnabled: config.aiGenerationEnabled,
      aiModel: config.aiModel,
      planningHorizonMonths: config.planningHorizonMonths,
      enabledPlatforms: config.enabledPlatforms,
      enabledPillars: config.enabledPillars,
    },
  };
}

export type UserDirectory = {
  entries: DirectoryEntry[];
  /** ALLOWED_EMAILS entries that still need importing into the database. */
  pending_import: string[];
};

export async function getUserDirectory(
  admin: AdminActor,
  now = new Date(),
): Promise<UserDirectory> {
  assertAdmin(admin);
  const { entries } = await loadDirectory(now);
  return {
    entries,
    pending_import: entries
      .filter((entry) => entry.access === "environment")
      .map((entry) => entry.email),
  };
}

export type AdminSettings = {
  overrides: AppSettingsRow;
  defaults: RuntimeConfig;
  effective: RuntimeConfig;
};

export async function getAdminSettings(
  admin: AdminActor,
): Promise<AdminSettings> {
  assertAdmin(admin);
  const overrides = await getSettingsOverrides();
  return {
    overrides,
    defaults: runtimeDefaults(env),
    effective: resolveRuntimeConfig(env, overrides),
  };
}

export async function getInstructionHistory(
  admin: AdminActor,
): Promise<Record<PromptScope, PromptInstruction[]>> {
  assertAdmin(admin);
  const rows = await listPromptInstructions();
  const versions = (scope: PromptScope) =>
    rows.filter((row) => row.scope === scope);
  return {
    content: versions("content"),
    planning: versions("planning"),
    daily_tip: versions("daily_tip"),
  };
}

function refuse(reason: string): never {
  throw new ActionFailure(
    "VALIDATION",
    reason,
    `${reason} Nothing was changed.`,
  );
}

function assertManageable(admin: AdminActor, email: string) {
  assertAdmin(admin);
  if (isEmailListed(email, env.ADMIN_EMAILS))
    refuse("Owner access is managed in the server environment.");
  // Prevents an admin from locking themselves out of the panel.
  if (email === admin.email)
    refuse("You can't change your own access. Ask another admin.");
}

export async function grantAccess(
  admin: AdminActor,
  input: GrantAccessInput,
): Promise<{ email: string; status: "granted" | "updated" }> {
  assertManageable(admin, input.email);
  const changes = {
    role: input.role,
    is_active: true,
    can_generate: input.can_generate,
  };
  const existing = await findAppUser(input.email);
  if (existing) {
    await updateAppUser(input.email, changes, admin.email);
    return { email: input.email, status: "updated" };
  }
  await insertAppUser({ email: input.email, ...changes }, admin.email);
  return { email: input.email, status: "granted" };
}

export async function updateAccess(
  admin: AdminActor,
  input: UpdateAccessInput,
): Promise<{ email: string }> {
  assertManageable(admin, input.email);
  const changes = {
    ...(input.role === undefined ? {} : { role: input.role }),
    ...(input.is_active === undefined ? {} : { is_active: input.is_active }),
    ...(input.can_generate === undefined
      ? {}
      : { can_generate: input.can_generate }),
  };
  if (await updateAppUser(input.email, changes, admin.email))
    return { email: input.email };
  // A legacy ALLOWED_EMAILS entry gets its first database row here, so a
  // revoke takes precedence over the environment list.
  if (!isEmailListed(input.email, env.ALLOWED_EMAILS))
    refuse("This person doesn't have access yet. Grant access first.");
  await insertAppUser(
    {
      email: input.email,
      role: changes.role ?? "member",
      is_active: changes.is_active ?? true,
      can_generate: changes.can_generate ?? true,
    },
    admin.email,
  );
  return { email: input.email };
}

export async function importEnvironmentAllowlist(
  admin: AdminActor,
): Promise<{ imported: number }> {
  assertAdmin(admin);
  const emails = parseEmailList(env.ALLOWED_EMAILS).filter(
    (email) => !isEmailListed(email, env.ADMIN_EMAILS),
  );
  return { imported: await insertMissingMembers(emails, admin.email) };
}

export async function updateSettings(
  admin: AdminActor,
  input: AppSettingsUpdate,
): Promise<{ updated_at: string }> {
  assertAdmin(admin);
  return updateSettingsOverrides(input, admin.email);
}

export async function saveInstructions(
  admin: AdminActor,
  input: SaveInstructionsInput,
): Promise<{ version: number | null; changed: boolean }> {
  assertAdmin(admin);
  const current = (await listPromptInstructions()).find(
    (row) => row.scope === input.scope,
  );
  if ((current?.instructions ?? "") === input.instructions)
    return { version: current?.id ?? null, changed: false };
  const saved = await insertPromptInstruction(
    input.scope,
    input.instructions,
    admin.email,
  );
  return { version: saved.id, changed: true };
}
