import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAccess, type AccessDecision } from "../../lib/auth/access";
import { isEmailListed, normalizeEmail } from "../../lib/auth/allowlist";
import { getAccessRecord } from "../db/access";
import type { Database } from "../db/database.types";

export type AccessLists = { ownerEmails: string; allowedEmails: string };

/**
 * Layer-2 access for a verified session (ARCHITECTURE.md §6.2). Returns
 * `null` when the access list cannot be read, so every caller fails closed.
 * Shared by middleware, so no `server-only` import.
 */
export async function lookupAccess(
  client: SupabaseClient<Database>,
  email: string | null | undefined,
  lists: AccessLists,
): Promise<AccessDecision | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { allowed: false };
  // Owners never depend on the database, so an outage cannot lock them out.
  if (isEmailListed(normalized, lists.ownerEmails))
    return resolveAccess({ email: normalized, ...lists, record: null });
  try {
    const record = await getAccessRecord(client, normalized);
    return resolveAccess({ email: normalized, ...lists, record });
  } catch (failure) {
    console.error("Access list lookup failed.", {
      code:
        typeof failure === "object" && failure !== null && "code" in failure
          ? String(failure.code)
          : undefined,
    });
    return null;
  }
}
