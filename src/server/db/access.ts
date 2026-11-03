import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessRecordSchema, type AccessRecord } from "../../lib/schemas/admin";
import type { Database } from "./database.types";

// Runs as the signed-in user: RLS exposes only that user's own row
// (DATABASE.md §7.3). Shared by middleware, so no `server-only` import.
export async function getAccessRecord(
  client: SupabaseClient<Database>,
  email: string,
): Promise<AccessRecord | null> {
  const { data, error } = await client
    .from("app_users")
    .select("role,is_active,can_generate")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data ? AccessRecordSchema.parse(data) : null;
}
