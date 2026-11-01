"use server";

import "server-only";
import { redirect } from "next/navigation";
import { createUserDatabaseClient } from "../db/client";

export async function signOut(): Promise<void> {
  const supabase = await createUserDatabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    console.error("Session sign-out failed.");
    redirect("/no-access?error=signout");
  }

  redirect("/sign-in?notice=signed-out");
}
