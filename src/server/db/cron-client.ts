import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { Database } from "./database.types";

export function createCronServiceRoleClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
