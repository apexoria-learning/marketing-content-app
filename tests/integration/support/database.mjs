import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATIONS_DIRECTORY = path.resolve("supabase", "migrations");
const SEED_FILE = path.resolve("supabase", "seed.sql");

// The Supabase platform provides these roles and default table grants; the
// numbered migrations deliberately assume they already exist (DATABASE.md §7.2).
const SUPABASE_BOOTSTRAP = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  grant usage on schema public to anon, authenticated, service_role;

  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
`;

export const APPLICATION_TABLES = [
  "activity_log",
  "brand_profile",
  "content_items",
  "content_plans",
  "daily_tips",
  "generation_runs",
  "news_items",
  "rate_limits",
];

export async function readMigrations() {
  const entries = await readdir(MIGRATIONS_DIRECTORY);

  return entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .map((entry) => path.join(MIGRATIONS_DIRECTORY, entry));
}

export async function createTestDatabase({ seed = false } = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto } });

  await db.exec(SUPABASE_BOOTSTRAP);

  for (const migration of await readMigrations()) {
    await db.exec(await readFile(migration, "utf8"));
  }

  if (seed) {
    await db.exec(await readFile(SEED_FILE, "utf8"));
  }

  return db;
}

/** Runs `operation` as a Postgres role, always restoring the superuser after. */
export async function asRole(db, role, operation) {
  await db.exec(`set role ${role};`);

  try {
    return await operation();
  } finally {
    await db.exec("reset role;");
  }
}

export async function expectRejection(operation) {
  try {
    await operation();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error("Expected the statement to be rejected, but it succeeded.");
}

const CONTENT_ITEM_DEFAULTS = {
  scheduled_date: "2026-06-01",
  slot: 1,
  platform: "instagram",
  format: "carousel",
  pillar: "salesforce_tips",
  idea: "A seeded idea",
  status: "idea",
};

/** Inserts a content_items row, returning its id. */
export async function insertContentItem(db, overrides = {}) {
  const row = { ...CONTENT_ITEM_DEFAULTS, ...overrides };
  const columns = Object.keys(row);
  const placeholders = columns.map((_, index) => `$${index + 1}`);

  const result = await db.query(
    `insert into public.content_items (${columns.join(", ")})
     values (${placeholders.join(", ")})
     returning id`,
    Object.values(row),
  );

  return result.rows[0].id;
}

/** A fully hydrated payload, so `ready`/`posted` rows satisfy their constraints. */
export function hydratedFields(overrides = {}) {
  return {
    hook: "A scroll-stopping first line",
    caption: "A complete, paste-ready caption.",
    body: JSON.stringify({ slides: [{ index: 1, headline: "One" }] }),
    design_brief: JSON.stringify({ objective: "Teach one thing" }),
    hydrated_at: "2026-05-30T03:00:00Z",
    ...overrides,
  };
}
