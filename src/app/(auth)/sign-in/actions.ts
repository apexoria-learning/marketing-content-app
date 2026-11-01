"use server";

import "server-only";
import { redirect } from "next/navigation";
import { getSafeRedirectPath } from "../../../lib/auth/redirect";
import { env } from "../../../server/config/env";
import { createUserDatabaseClient } from "../../../server/db/client";

export async function beginGoogleSignIn(formData: FormData): Promise<void> {
  const nextPath = getSafeRedirectPath(formData.get("next")?.toString());
  const callbackUrl = new URL("/auth/callback", env.NEXT_PUBLIC_APP_URL);
  callbackUrl.searchParams.set("next", nextPath);

  const supabase = await createUserDatabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error || !data.url) {
    console.error("Google OAuth initiation failed.");
    redirect("/sign-in?error=oauth");
  }

  redirect(data.url);
}
