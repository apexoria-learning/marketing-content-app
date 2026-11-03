import { z } from "zod";
import { resolveAccess } from "../auth/access";
import { parseEmailList } from "../auth/allowlist";
import type { AppRole, AppUser } from "../schemas/admin";
import type { UsageRun } from "./usage-summary";

export const AuthAccountSchema = z.object({
  email: z.string().min(3),
  name: z.string().nullable(),
  created_at: z.string().nullable(),
  last_sign_in_at: z.string().nullable(),
});
export type AuthAccount = z.infer<typeof AuthAccountSchema>;

export type DirectoryAccess =
  "owner" | "granted" | "environment" | "revoked" | "no_access";

export type DirectoryEntry = {
  email: string;
  name: string | null;
  access: DirectoryAccess;
  role: AppRole;
  can_generate: boolean;
  last_sign_in_at: string | null;
  last_active_at: string | null;
  runs: number;
  tokens: number;
  updated_by: string | null;
  updated_at: string | null;
};

export type UserBaseSummary = {
  with_access: number;
  active_7d: number;
  active_30d: number;
  awaiting_access: number;
  revoked: number;
};

function latest(...values: (string | null | undefined)[]): string | null {
  let result: string | null = null;
  for (const value of values)
    if (value && (!result || Date.parse(value) > Date.parse(result)))
      result = value;
  return result;
}

/**
 * One row per known person: owners, database grants, legacy ALLOWED_EMAILS
 * entries and every Google account that has signed in (including denied
 * ones, so they can be granted access in one step).
 */
export function buildUserDirectory(input: {
  ownerEmails: string;
  allowedEmails: string;
  records: readonly AppUser[];
  accounts: readonly AuthAccount[];
  runs: readonly UsageRun[];
  activity: readonly { actor_email: string | null; created_at: string }[];
}): DirectoryEntry[] {
  const records = new Map(input.records.map((row) => [row.email, row]));
  const accounts = new Map(
    input.accounts.map((account) => [account.email.toLowerCase(), account]),
  );
  const lastSeen = new Map<string, string>();
  const usage = new Map<string, { runs: number; tokens: number }>();
  for (const event of input.activity) {
    const email = event.actor_email?.toLowerCase();
    if (email)
      lastSeen.set(
        email,
        latest(lastSeen.get(email), event.created_at) ?? event.created_at,
      );
  }
  for (const run of input.runs) {
    const email = run.actor_email?.toLowerCase();
    if (!email) continue;
    lastSeen.set(
      email,
      latest(lastSeen.get(email), run.started_at) ?? run.started_at,
    );
    const entry = usage.get(email) ?? { runs: 0, tokens: 0 };
    entry.runs += 1;
    entry.tokens += (run.input_tokens ?? 0) + (run.output_tokens ?? 0);
    usage.set(email, entry);
  }
  const emails = new Set([
    ...parseEmailList(input.ownerEmails),
    ...parseEmailList(input.allowedEmails),
    ...records.keys(),
    ...accounts.keys(),
  ]);
  return [...emails].sort().map((email) => {
    const record = records.get(email) ?? null;
    const account = accounts.get(email);
    const decision = resolveAccess({
      email,
      ownerEmails: input.ownerEmails,
      allowedEmails: input.allowedEmails,
      record,
    });
    const access: DirectoryAccess = decision.allowed
      ? decision.source === "owner"
        ? "owner"
        : decision.source === "database"
          ? "granted"
          : "environment"
      : record
        ? "revoked"
        : "no_access";
    return {
      email,
      name: account?.name ?? null,
      access,
      role: decision.allowed ? decision.role : (record?.role ?? "member"),
      can_generate: decision.allowed
        ? decision.canGenerate
        : (record?.can_generate ?? false),
      last_sign_in_at: account?.last_sign_in_at ?? null,
      last_active_at: latest(account?.last_sign_in_at, lastSeen.get(email)),
      runs: usage.get(email)?.runs ?? 0,
      tokens: usage.get(email)?.tokens ?? 0,
      updated_by: record?.updated_by ?? null,
      updated_at: record?.updated_at ?? null,
    };
  });
}

export function hasAccess(entry: Pick<DirectoryEntry, "access">) {
  return ["owner", "granted", "environment"].includes(entry.access);
}

export function summarizeUserBase(
  entries: readonly DirectoryEntry[],
  now = new Date(),
): UserBaseSummary {
  const within = (entry: DirectoryEntry, days: number) =>
    entry.last_active_at !== null &&
    now.getTime() - Date.parse(entry.last_active_at) <= days * 86_400_000;
  const members = entries.filter(hasAccess);
  return {
    with_access: members.length,
    active_7d: members.filter((entry) => within(entry, 7)).length,
    active_30d: members.filter((entry) => within(entry, 30)).length,
    awaiting_access: entries.filter((entry) => entry.access === "no_access")
      .length,
    revoked: entries.filter((entry) => entry.access === "revoked").length,
  };
}
