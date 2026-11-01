import { expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: create }));
vi.mock("../../src/server/config/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-only-service-key",
  },
}));
import { createCronServiceRoleClient } from "../../src/server/db/cron-client";

it("creates the isolated cron client without browser session behavior", () => {
  createCronServiceRoleClient();
  expect(create).toHaveBeenCalledWith(
    "https://project.supabase.co",
    "test-only-service-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
});
