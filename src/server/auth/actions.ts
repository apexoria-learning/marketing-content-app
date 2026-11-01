"use server";

import "server-only";
import { redirect } from "next/navigation";
import { destroyUserSession } from "../db/client";

export async function signOut(): Promise<void> {
  const isRevoked = await destroyUserSession();
  redirect(
    isRevoked ? "/sign-in?notice=signed-out" : "/sign-in?notice=local-signout",
  );
}
