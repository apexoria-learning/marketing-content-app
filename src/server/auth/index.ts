import "server-only";
import { env } from "../config/env";
import { createUserDatabaseClient } from "../db/client";
import { isEmailAllowed } from "../../lib/auth/allowlist";

export type AuthorizedUser =
  | { ok: true; user: { id: string; email: string; role: "team_member" } }
  | {
      ok: false;
      code: "UNAUTHENTICATED" | "FORBIDDEN" | "UNEXPECTED";
    };

export async function getAuthorizedUser(): Promise<AuthorizedUser> {
  const supabase = await createUserDatabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Session verification failed.", error);
    return { ok: false, code: "UNEXPECTED" };
  }

  if (!data.user) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }

  const email = data.user.email?.trim().toLowerCase();

  if (!email || !isEmailAllowed(email, env.ALLOWED_EMAILS)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  return {
    ok: true,
    user: { id: data.user.id, email, role: "team_member" },
  };
}
