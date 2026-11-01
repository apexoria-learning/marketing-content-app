import { NextRequest, NextResponse } from "next/server";
import { isEmailAllowed } from "../../../lib/auth/allowlist";
import { getSafeRedirectPath } from "../../../lib/auth/redirect";
import { env } from "../../../server/config/env";
import {
  createUserDatabaseClient,
  destroyUserSession,
} from "../../../server/db/client";

function signInRedirect(request: NextRequest, error: "oauth" | "exchange") {
  const destination = new URL("/sign-in", request.url);
  destination.searchParams.set("error", error);
  return NextResponse.redirect(destination, { status: 302 });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  if (searchParams.has("error")) {
    console.error("Google OAuth provider rejected or cancelled sign-in.");
    return signInRedirect(request, "oauth");
  }

  const code = searchParams.get("code");

  if (!code) {
    console.error("Google OAuth callback is missing its authorization code.");
    return signInRedirect(request, "exchange");
  }

  const supabase = await createUserDatabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("Google OAuth code exchange failed.", {
      code: error?.code,
      status: error?.status,
    });
    return signInRedirect(request, "exchange");
  }

  if (!isEmailAllowed(data.user.email, env.ALLOWED_EMAILS)) {
    await destroyUserSession(supabase);

    return NextResponse.redirect(new URL("/no-access", request.url), {
      status: 302,
    });
  }

  const destination = new URL(
    getSafeRedirectPath(searchParams.get("next")),
    request.url,
  );
  return NextResponse.redirect(destination, { status: 302 });
}
