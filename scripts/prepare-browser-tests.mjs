import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import pg from "pg";
import { parseLocalDatabaseUrl } from "../tests/integration/support/local-database.mjs";

if (process.env.CI !== "true" || process.env.RUN_SEEDED_E2E !== "true")
  throw new Error("Seeded browser setup is restricted to isolated CI.");
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
if (url.origin !== "http://127.0.0.1:54321" || url.pathname !== "/")
  throw new Error("Browser setup requires the isolated loopback Supabase API.");
const databaseUrl = parseLocalDatabaseUrl(process.env.DATABASE_URL).toString();
const email = "browser-test@example.test";
const password = randomBytes(32).toString("hex");
const admin = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createError)
  throw new Error(
    `Isolated test-user creation failed (${createError.status}).`,
  );
const cookies = [];
const auth = createServerClient(
  url.href,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 604800,
    },
    cookies: { getAll: () => [], setAll: (values) => cookies.push(...values) },
  },
);
const { error: signInError } = await auth.auth.signInWithPassword({
  email,
  password,
});
if (signInError)
  throw new Error(`Isolated test login failed (${signInError.status}).`);
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/seeded-auth.json",
  JSON.stringify({
    cookies: cookies.map(({ name, value, options }) => ({
      name,
      value,
      domain: "127.0.0.1",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + (options.maxAge ?? 604800),
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    })),
    origins: [],
  }),
);
const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
try {
  // Older, fully hydrated fixtures exercise the exact 30-row keyset boundary.
  await db.query(`
    insert into public.content_items
    select (jsonb_populate_record(null::public.content_items, to_jsonb(template) ||
      jsonb_build_object(
        'id', gen_random_uuid(), 'plan_id', null,
        'scheduled_date', current_date - 90 - n, 'slot', 1,
        'status', 'posted', 'posted_at', (current_date - 90 - n)::timestamptz,
        'posted_by', 'browser-test@example.test', 'skip_reason', null
      ))).*
    from (select * from public.content_items where status = 'ready' limit 1) template,
      generate_series(1, 65) n
  `);
  await db.query(
    "update public.content_items set caption = $1 where scheduled_date = (now() at time zone 'Asia/Kolkata')::date and status = 'ready' and slot = 1",
    ["First line\n\nSecond line 🚀"],
  );
  const fixtures = await db.query(
    "select distinct on (format) id, format from public.content_items where body is not null and status in ('ready','posted') order by format, scheduled_date desc",
  );
  if (fixtures.rows.length !== 6)
    throw new Error(
      "Isolated browser fixtures must cover all six hydrated formats.",
    );
  await writeFile(
    "test-results/content-fixtures.json",
    JSON.stringify(fixtures.rows),
  );
} finally {
  await db.end();
}
console.log(
  "Isolated browser user and pagination fixtures prepared. Credentials remain in ignored test output.",
);
