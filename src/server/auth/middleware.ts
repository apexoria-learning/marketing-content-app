import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";
import { lookupAccess } from "./access";

export type MiddlewareAccess = "allowed" | "denied" | "unknown";

// Middleware is a convenience layer; "unknown" defers to the (app) layout,
// which fails closed (ARCHITECTURE.md §6.4).
export async function getMiddlewareAccess(
  client: SupabaseClient<Database>,
  email: string | null | undefined,
): Promise<MiddlewareAccess> {
  const decision = await lookupAccess(client, email, {
    ownerEmails: process.env.ADMIN_EMAILS ?? "",
    allowedEmails: process.env.ALLOWED_EMAILS ?? "",
  });
  if (decision === null) return "unknown";
  return decision.allowed ? "allowed" : "denied";
}
