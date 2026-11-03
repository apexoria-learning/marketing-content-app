import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { parseLocalDatabaseUrl } from "./local-database.mjs";

const MIGRATIONS_DIRECTORY = path.resolve("supabase", "migrations");
const SEED_FILE = path.resolve("supabase", "seed.sql");

// `supabase start` exposes Postgres here (supabase/config.toml [db] port).
// Set DATABASE_URL to override. The target must grant CREATE DATABASE, since
// each suite runs in a throwaway database — so this targets a *local*
// instance, not the hosted project (ARCHITECTURE.md §14.2).
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const databaseUrl = parseLocalDatabaseUrl(
  process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
).toString();

// Supabase provisions these cluster-wide, so create them only when absent —
// a scratch database on the same cluster shares them (DATABASE.md §7.2).
const SUPABASE_ROLES = `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin bypassrls;
    end if;
  end
  $$;
`;

const SUPABASE_BOOTSTRAP = `
  grant usage on schema public to anon, authenticated, service_role;

  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public
    grant execute on functions to anon, authenticated, service_role;

  -- Minimal stand-in for Supabase Auth's users table: only the columns that
  -- public.user_display_names reads. Like Supabase, no grants to API roles.
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
`;

export const APPLICATION_TABLES = [
  "activity_log",
  "app_settings",
  "app_users",
  "brand_profile",
  "content_items",
  "content_plans",
  "daily_tips",
  "generation_runs",
  "news_items",
  "platform_formats",
  "platforms",
  "prompt_instructions",
  "rate_limits",
];

/**
 * Integration tests need a real Postgres (ARCHITECTURE.md §14.2). When none is
 * reachable the suite skips rather than failing, so `npm test` stays usable
 * without the local Supabase stack running.
 */
export async function isDatabaseReachable() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 3000,
  });

  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    if (process.env.REQUIRE_DATABASE_TESTS === "true") {
      throw new Error(
        "Required isolated PostgreSQL database is unreachable. Database tests must not be skipped in CI.",
      );
    }

    return false;
  }
}

export async function readMigrations() {
  const entries = await readdir(MIGRATIONS_DIRECTORY);

  return entries
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .map((entry) => path.join(MIGRATIONS_DIRECTORY, entry));
}

async function connectTo(database) {
  const url = new URL(databaseUrl);

  url.pathname = `/${database}`;

  const client = new pg.Client({ connectionString: url.toString() });

  await client.connect();

  return client;
}

export function createTestDatabasePool(client) {
  const url = new URL(databaseUrl);

  url.pathname = `/${client.scratchDatabaseName}`;

  return new pg.Pool({ connectionString: url.toString(), max: 10 });
}

/**
 * Provisions a throwaway database, applies every migration in order, and
 * optionally the development seed. Isolated per suite so mutating assertions
 * never touch the developer's own data.
 */
export async function createTestDatabase({ seed = false } = {}) {
  const name = `apexoria_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: databaseUrl });

  await admin.connect();

  try {
    // Roles are cluster-wide, so parallel suites coordinate in the admin DB.
    await admin.query("begin");
    await admin.query("select pg_advisory_xact_lock(20261101)");
    await admin.query(SUPABASE_ROLES);
    await admin.query("commit");
    await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }

  const client = await connectTo(name);

  client.scratchDatabaseName = name;

  await client.query(SUPABASE_BOOTSTRAP);

  for (const migration of await readMigrations()) {
    await client.query(await readFile(migration, "utf8"));
  }

  if (seed) {
    await client.query(await readFile(SEED_FILE, "utf8"));
  }

  return client;
}

export async function applySeed(client) {
  await client.query(await readFile(SEED_FILE, "utf8"));
}

export async function applyMigration(client, fileName) {
  await client.query(
    await readFile(path.join(MIGRATIONS_DIRECTORY, fileName), "utf8"),
  );
}

export async function dropTestDatabase(client) {
  if (!client) {
    return;
  }

  const name = client.scratchDatabaseName;

  await client.end();

  const admin = new pg.Client({ connectionString: databaseUrl });

  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.end();
}

/** Runs `operation` as a Postgres role, always restoring the superuser after. */
export async function asRole(db, role, operation) {
  await db.query(`set role ${role};`);

  try {
    return await operation();
  } finally {
    await db.query("reset role;");
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
