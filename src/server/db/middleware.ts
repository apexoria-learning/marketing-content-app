import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import {
  getAuthCookieOptions,
  getSessionCookieName,
  isSessionCookie,
} from "../../lib/auth/session-cookie";
import type { Database } from "./database.types";

type AuthCookie = { name: string; value: string; options: CookieOptions };

export function createMiddlewareDatabaseClient(
  request: NextRequest,
  setCookies: (cookies: AuthCookie[], headers: Record<string, string>) => void,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase middleware configuration is missing.");
  }

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: getAuthCookieOptions(process.env.NODE_ENV === "production"),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies, headers) {
        setCookies(cookies, headers);
      },
    },
  });
}

export function getExpiredSessionCookies(request: NextRequest): AuthCookie[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("Supabase middleware configuration is missing.");
  }

  const sessionName = getSessionCookieName(url);

  return request.cookies
    .getAll()
    .filter((cookie) => isSessionCookie(cookie.name, sessionName))
    .map((cookie) => ({
      name: cookie.name,
      value: "",
      options: {
        ...getAuthCookieOptions(process.env.NODE_ENV === "production"),
        maxAge: 0,
      },
    }));
}
