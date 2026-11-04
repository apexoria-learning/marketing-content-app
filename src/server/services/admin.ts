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
  getBusinessProfile,
  getGlobalAllowanceUsed,
  getSettingsOverrides,
  insertAppUser,
  insertMissingMembers,
  insertPromptInstruction,
  listActivityActors,
  listAppUsers,
  listAuthAccounts,
  listPillars,
  listPlatforms,
  listPromptInstructions,
  listUsageRuns,
  savePillar,
  savePlatform,
  setPillarSortOrder,
  setPlatformSortOrder,
  updateAppUser,
  updateBusinessProfile,
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
import {
  hasPlannablePlatforms,
  type MovePlatformInput,
  type PlatformRecord,
  type SavePlatformInput,
} from "../../lib/schemas/platforms";
import {
  pillarPlannabilityError,
  type MovePillarInput,
  type PillarRecord,
  type SavePillarInput,
} from "../../lib/schemas/pillars";
import type {
  BusinessProfile,
  BusinessProfileRecord,
} from "../../lib/schemas/business-profile";
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
    "aiGenerationEnabled" | "aiModel" | "planningHorizonMonths"
  > & { enabledPlatformLabels: string[]; enabledPillarLabels: string[] };
};

export async function getAdminOverview(
  admin: AdminActor,
  now = new Date(),
): Promise<AdminOverview> {
  assertAdmin(admin);
  const [{ runs, entries }, overrides, used, platforms, pillars] =
    await Promise.all([
      loadDirectory(now),
      getSettingsOverrides(),
      getGlobalAllowanceUsed(`${todayInIst(now)}T00:00:00+05:30`),
      listPlatforms(),
      listPillars(),
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
      enabledPlatformLabels: platforms
        .filter((platform) => platform.is_enabled)
        .map((platform) => platform.label),
      enabledPillarLabels: pillars
        .filter((pillar) => pillar.is_enabled)
        .map((pillar) => pillar.label),
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

export async function getPlatformCatalogueForAdmin(
  admin: AdminActor,
): Promise<PlatformRecord[]> {
  assertAdmin(admin);
  return listPlatforms();
}

export async function savePlatformEntry(
  admin: AdminActor,
  input: SavePlatformInput,
): Promise<{ key: string; status: "created" | "updated" }> {
  assertAdmin(admin);
  const catalogue = await listPlatforms();
  const existing = catalogue.find(
    (platform) => platform.key === input.platform.key,
  );
  if (input.mode === "create" && existing)
    refuse("A platform with this key already exists. Edit it instead.");
  if (input.mode === "update" && !existing)
    refuse("This platform no longer exists.");
  // The database re-checks this inside the same transaction (0016).
  const next = [
    ...catalogue.filter((platform) => platform.key !== input.platform.key),
    input.platform,
  ];
  if (!hasPlannablePlatforms(next))
    refuse(
      "Keep at least two enabled platform formats so months can still be planned.",
    );
  await savePlatform(input.platform, input.mode === "create", admin.email);
  return {
    key: input.platform.key,
    status: input.mode === "create" ? "created" : "updated",
  };
}

export async function movePlatform(
  admin: AdminActor,
  input: MovePlatformInput,
): Promise<{ key: string }> {
  assertAdmin(admin);
  const order = swapWithNeighbour(
    (await listPlatforms()).map((platform) => platform.key),
    input,
    "This platform no longer exists.",
  );
  // Renumber in display order so ties from older rows cannot persist.
  for (const [position, key] of order.entries())
    await setPlatformSortOrder(key, position + 1, admin.email);
  return { key: input.key };
}

/** The order after moving `key` one place; empty when already at that end. */
function swapWithNeighbour(
  order: string[],
  { key, direction }: { key: string; direction: "up" | "down" },
  missing: string,
): string[] {
  const index = order.indexOf(key);
  if (index < 0) refuse(missing);
  const target = direction === "up" ? index - 1 : index + 1;
  const neighbour = order[target];
  if (neighbour === undefined) return [];
  order[target] = key;
  order[index] = neighbour;
  return order;
}

export async function getPillarCatalogueForAdmin(
  admin: AdminActor,
): Promise<PillarRecord[]> {
  assertAdmin(admin);
  return listPillars();
}

export async function savePillarEntry(
  admin: AdminActor,
  input: SavePillarInput,
): Promise<{ key: string; status: "created" | "updated" }> {
  assertAdmin(admin);
  const catalogue = await listPillars();
  const existing = catalogue.some((pillar) => pillar.key === input.pillar.key);
  if (input.mode === "create" && existing)
    refuse("A pillar with this key already exists. Edit it instead.");
  if (input.mode === "update" && !existing)
    refuse("This pillar no longer exists.");
  // The database re-checks this inside the same transaction (0017).
  const problem = pillarPlannabilityError([
    ...catalogue.filter((pillar) => pillar.key !== input.pillar.key),
    input.pillar,
  ]);
  if (problem) refuse(`${problem} Months must stay plannable.`);
  await savePillar(input.pillar, input.mode === "create", admin.email);
  return {
    key: input.pillar.key,
    status: input.mode === "create" ? "created" : "updated",
  };
}

export async function movePillar(
  admin: AdminActor,
  input: MovePillarInput,
): Promise<{ key: string }> {
  assertAdmin(admin);
  const order = swapWithNeighbour(
    (await listPillars()).map((pillar) => pillar.key),
    input,
    "This pillar no longer exists.",
  );
  for (const [position, key] of order.entries())
    await setPillarSortOrder(key, position + 1, admin.email);
  return { key: input.key };
}

export async function getBusinessProfileForAdmin(
  admin: AdminActor,
): Promise<BusinessProfileRecord> {
  assertAdmin(admin);
  return getBusinessProfile();
}

/** Affects only later generations; existing content is never rewritten. */
export async function saveBusinessProfile(
  admin: AdminActor,
  profile: BusinessProfile,
): Promise<{ updated_at: string }> {
  assertAdmin(admin);
  return updateBusinessProfile(profile, admin.email);
}
