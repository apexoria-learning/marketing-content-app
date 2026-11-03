import "server-only";
import { cache } from "react";
import { env } from "../config/env";
import { createUserDatabaseClient } from "../db/client";
import type { AppRole } from "../../lib/schemas/admin";
import { lookupAccess } from "./access";
import { isUnauthenticatedError } from "./session-error";

export type SessionUser = {
  id: string;
  email: string;
  role: AppRole;
  canGenerate: boolean;
  isOwner: boolean;
};

export type AuthorizedUser =
  | { ok: true; user: SessionUser }
  | {
      ok: false;
      code: "UNAUTHENTICATED" | "FORBIDDEN" | "UNEXPECTED";
    };

declare const adminActor: unique symbol;

/**
 * Proof that the server verified an admin session in this request. Admin
 * services take it as their first argument, so privileged reads and writes
 * cannot be reached without the check (ARCHITECTURE.md §6.3).
 */
export type AdminActor = {
  readonly email: string;
  readonly isOwner: boolean;
  readonly [adminActor]: true;
};

export function toAdminActor(user: SessionUser): AdminActor | null {
  if (user.role !== "admin") return null;
  return { email: user.email, isOwner: user.isOwner } as AdminActor;
}

// Memoized per server render so the layout, pages and data loaders share one
// verification; actions still verify independently.
export const getAuthorizedUser = cache(async (): Promise<AuthorizedUser> => {
  const supabase = await createUserDatabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (isUnauthenticatedError(error)) {
      return { ok: false, code: "UNAUTHENTICATED" };
    }

    console.error("Session verification failed.", {
      name: error.name,
      code: error.code,
      status: error.status,
    });
    return { ok: false, code: "UNEXPECTED" };
  }

  if (!data.user) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }

  const email = data.user.email?.trim().toLowerCase();

  if (!email) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const access = await lookupAccess(supabase, email, {
    ownerEmails: env.ADMIN_EMAILS,
    allowedEmails: env.ALLOWED_EMAILS,
  });

  if (access === null) {
    return { ok: false, code: "UNEXPECTED" };
  }

  if (!access.allowed) {
    return { ok: false, code: "FORBIDDEN" };
  }

  return {
    ok: true,
    user: {
      id: data.user.id,
      email,
      role: access.role,
      canGenerate: access.canGenerate,
      isOwner: access.source === "owner",
    },
  };
});
