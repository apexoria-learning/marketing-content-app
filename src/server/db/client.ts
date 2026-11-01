import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getAuthCookieOptions,
  getSessionCookieName,
  isSessionCookie,
} from "../../lib/auth/session-cookie";
import { env } from "../config/env";
import type { Database } from "./database.types";

export async function createUserDatabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: getAuthCookieOptions(
        process.env.NODE_ENV === "production",
      ),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}

export async function destroyUserSession(
  supabase?: Awaited<ReturnType<typeof createUserDatabaseClient>>,
): Promise<boolean> {
  const client = supabase ?? (await createUserDatabaseClient());
  let isRevoked = false;

  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    isRevoked = !error;

    if (error) {
      console.error("Session sign-out failed.", {
        code: error.code,
        status: error.status,
      });
    }
  } catch {
    console.error(
      "Session sign-out request failed; clearing local credentials.",
    );
  }

  // Clear local credentials even when remote revocation is unavailable.
  const cookieStore = await cookies();
  const name = getSessionCookieName(env.NEXT_PUBLIC_SUPABASE_URL);

  for (const cookie of cookieStore.getAll()) {
    if (isSessionCookie(cookie.name, name)) {
      cookieStore.set(cookie.name, "", {
        ...getAuthCookieOptions(process.env.NODE_ENV === "production"),
        maxAge: 0,
      });
    }
  }

  return isRevoked;
}
