import type { AccessRecord, AppRole } from "../schemas/admin";
import { isEmailListed, normalizeEmail } from "./allowlist";

export type AccessSource = "owner" | "database" | "environment";

export type AccessDecision =
  | { allowed: false }
  | {
      allowed: true;
      role: AppRole;
      canGenerate: boolean;
      source: AccessSource;
    };

/**
 * Resolves layer-2 access (ARCHITECTURE.md §6.2), in precedence order:
 * 1. ADMIN_EMAILS owners — always admins, so the panel can never lock out.
 * 2. A database access row — active grants, inactive revokes (even if the
 *    email is still in ALLOWED_EMAILS).
 * 3. ALLOWED_EMAILS — legacy entries not yet imported into the database.
 * Anything else, including empty lists, is denied.
 */
export function resolveAccess(input: {
  email: string | null | undefined;
  ownerEmails: string;
  allowedEmails: string;
  record: AccessRecord | null;
}): AccessDecision {
  const email = normalizeEmail(input.email);
  if (!email) return { allowed: false };
  if (isEmailListed(email, input.ownerEmails))
    return { allowed: true, role: "admin", canGenerate: true, source: "owner" };
  if (input.record)
    return input.record.is_active
      ? {
          allowed: true,
          role: input.record.role,
          canGenerate: input.record.can_generate,
          source: "database",
        }
      : { allowed: false };
  if (isEmailListed(email, input.allowedEmails))
    return {
      allowed: true,
      role: "member",
      canGenerate: true,
      source: "environment",
    };
  return { allowed: false };
}
