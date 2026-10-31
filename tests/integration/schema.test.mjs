// DATABASE.md ??11 ??? release gates for the data layer.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  APPLICATION_TABLES,
  asRole,
  createTestDatabase,
  expectRejection,
  hydratedFields,
  insertContentItem,
} from "./support/database.mjs";

let db;

beforeAll(async () => {
  db = await createTestDatabase();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("migrations", () => {
  it("apply cleanly to an empty database and create all eight tables", async () => {
    const result = await db.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );

    expect(result.rows.map((row) => row.table_name)).toEqual(
      APPLICATION_TABLES,
    );
  });

  it("creates the eight enum types", async () => {
    const result = await db.query(
      `select typname from pg_type t
       join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public' and t.typtype = 'e'
       order by typname`,
    );

    expect(result.rows.map((row) => row.typname)).toEqual([
      "activity_action",
      "content_format",
      "content_pillar",
      "content_status",
      "plan_status",
      "platform",
      "run_kind",
      "run_status",
    ]);
  });

  it("creates exactly the seven indexes in ??6.3 and no others", async () => {
    const result = await db.query(
      `select indexname from pg_indexes
       where schemaname = 'public' and indexname like 'idx_%'
       order by indexname`,
    );

    expect(result.rows.map((row) => row.indexname)).toEqual([
      "idx_activity_log_item",
      "idx_content_items_hydration_queue",
      "idx_content_items_plan",
      "idx_content_items_posted",
      "idx_content_items_work_queue",
      "idx_generation_runs_recent",
      "idx_news_items_published",
    ]);
  });
});

describe("row level security", () => {
  it("is enabled on all eight tables (L4)", async () => {
    const result = await db.query(
      `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       order by c.relname`,
    );

    expect(result.rows.map((row) => row.relname)).toEqual(APPLICATION_TABLES);
  });

  it("returns zero rows to anon from every table", async () => {
    await db.exec(
      `insert into public.content_plans (plan_month) values ('2026-06-01');
       insert into public.daily_tips (tip_date, tip) values ('2026-06-01', 'A tip');
       insert into public.news_items (source, title, url, url_hash)
         values ('S', 'T', 'https://example.test/a', repeat('a', 64));
       insert into public.generation_runs (kind) values ('news_ingest');
       insert into public.rate_limits (actor_key, action_key, window_start, count)
         values ('someone@apexoria.test', 'regenerate', now(), 1);`,
    );
    await insertContentItem(db, { scheduled_date: "2026-06-02" });

    await asRole(db, "anon", async () => {
      for (const table of APPLICATION_TABLES) {
        const result = await db.query(`select * from public.${table}`);

        expect(result.rows, `${table} leaked rows to anon`).toHaveLength(0);
      }
    });
  });

  it("denies authenticated any direct access to rate_limits", async () => {
    await asRole(db, "authenticated", async () => {
      const selected = await db.query("select * from public.rate_limits");

      expect(selected.rows).toHaveLength(0);

      await expectRejection(() =>
        db.query(
          `insert into public.rate_limits (actor_key, action_key, window_start)
           values ('a@b.test', 'regenerate', now())`,
        ),
      );
    });
  });

  it("gives rate_limits no policies at all", async () => {
    const result = await db.query(
      "select policyname from pg_policies where tablename = 'rate_limits'",
    );

    expect(result.rows).toHaveLength(0);
  });

  it("grants authenticated no delete policy on any table", async () => {
    const result = await db.query(
      "select tablename from pg_policies where cmd = 'DELETE'",
    );

    expect(result.rows).toHaveLength(0);
  });
});

describe("consume_rate_limit", () => {
  it("is SECURITY DEFINER with an empty search_path", async () => {
    const result = await db.query(
      `select p.prosecdef, p.proconfig
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'consume_rate_limit'`,
    );

    expect(result.rows[0].prosecdef).toBe(true);
    expect(result.rows[0].proconfig).toEqual(['search_path=""']);
  });

  it("is executable by authenticated but not by public", async () => {
    const result = await db.query(
      `select
         has_function_privilege('authenticated', p.oid, 'execute') as authenticated_may,
         has_function_privilege('public', p.oid, 'execute')        as public_may
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'consume_rate_limit'`,
    );

    expect(result.rows[0].authenticated_may).toBe(true);
    expect(result.rows[0].public_may).toBe(false);
  });

  it("never allows the count to exceed the limit", async () => {
    const windowStart = "2026-06-01T00:00:00Z";
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        db.query(
          "select public.consume_rate_limit($1, $2, $3::timestamptz, $4) as allowed",
          ["burst@apexoria.test", "regenerate", windowStart, 3],
        ),
      ),
    );

    const granted = attempts.filter(
      (attempt) => attempt.rows[0]?.allowed === true,
    ).length;

    expect(granted).toBe(3);

    const stored = await db.query(
      `select count from public.rate_limits
       where actor_key = 'burst@apexoria.test' and window_start = $1::timestamptz`,
      [windowStart],
    );

    expect(stored.rows[0].count).toBe(3);
  });

  it("starts a fresh allowance in a new window", async () => {
    const result = await db.query(
      "select public.consume_rate_limit($1, $2, $3::timestamptz, $4) as allowed",
      ["burst@apexoria.test", "regenerate", "2026-06-02T00:00:00Z", 3],
    );

    expect(result.rows[0].allowed).toBe(true);
  });
});

describe("content_items constraints", () => {
  it("rejects a third item on one scheduled_date", async () => {
    await insertContentItem(db, { scheduled_date: "2026-07-01", slot: 1 });
    await insertContentItem(db, { scheduled_date: "2026-07-01", slot: 2 });

    const message = await expectRejection(() =>
      insertContentItem(db, { scheduled_date: "2026-07-01", slot: 3 }),
    );

    expect(message).toMatch(/content_items_slot_range/);
  });

  it("rejects a duplicate slot on one scheduled_date", async () => {
    await insertContentItem(db, { scheduled_date: "2026-07-02", slot: 1 });

    const message = await expectRejection(() =>
      insertContentItem(db, { scheduled_date: "2026-07-02", slot: 1 }),
    );

    expect(message).toMatch(/content_items_date_slot_unique/);
  });

  it.each([
    ["caption", { caption: undefined }],
    ["body", { body: undefined }],
    ["design_brief", { design_brief: undefined }],
    ["hydrated_at", { hydrated_at: undefined }],
  ])("rejects a ready item missing %s", async (_field, missing) => {
    const fields = hydratedFields();

    for (const [key, value] of Object.entries(missing)) {
      if (value === undefined) {
        delete fields[key];
      }
    }

    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2026-08-01",
        status: "ready",
        ...fields,
      }),
    );

    expect(message).toMatch(/content_items_usable_is_hydrated/);
  });

  it("rejects a ready salesforce_news item with empty source_refs", async () => {
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2026-08-02",
        pillar: "salesforce_news",
        status: "ready",
        ...hydratedFields(),
      }),
    );

    expect(message).toMatch(/content_items_news_requires_sources/);
  });

  it("accepts a ready salesforce_news item carrying a source", async () => {
    await expect(
      insertContentItem(db, {
        scheduled_date: "2026-08-03",
        pillar: "salesforce_news",
        status: "ready",
        source_refs: JSON.stringify([
          { title: "T", url: "https://example.test/a", source: "S" },
        ]),
        ...hydratedFields(),
      }),
    ).resolves.toBeDefined();
  });

  it("allows a sourceless non-news item", async () => {
    await expect(
      insertContentItem(db, {
        scheduled_date: "2026-08-04",
        pillar: "memes",
        format: "meme",
        status: "ready",
        ...hydratedFields(),
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a reel on LinkedIn", async () => {
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2026-08-05",
        platform: "linkedin",
        format: "reel",
      }),
    );

    expect(message).toMatch(/content_items_format_platform_valid/);
  });

  it("rejects a carousel on WhatsApp", async () => {
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2026-08-06",
        platform: "whatsapp",
        format: "carousel",
      }),
    );

    expect(message).toMatch(/content_items_format_platform_valid/);
  });

  it("rejects a WhatsApp item carrying hashtags", async () => {
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2026-08-07",
        platform: "whatsapp",
        format: "story",
        hashtags: "{#salesforce}",
      }),
    );

    expect(message).toMatch(/content_items_whatsapp_no_hashtags/);
  });

  it("rejects posted without posted_at and posted_by", async () => {
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2026-08-08",
        status: "posted",
        ...hydratedFields(),
      }),
    );

    expect(message).toMatch(/content_items_posted_consistent/);
  });

  it("rejects a skip_reason on an item that is not skipped", async () => {
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2026-08-09",
        skip_reason: "Changed our mind",
      }),
    );

    expect(message).toMatch(/content_items_skip_reason_only_when_skipped/);
  });

  it("rejects a non-first-of-month plan_month", async () => {
    const message = await expectRejection(() =>
      db.query(
        "insert into public.content_plans (plan_month) values ('2026-09-15')",
      ),
    );

    expect(message).toMatch(/content_plans_month_is_first_day/);
  });

  it("rejects a non-http news URL", async () => {
    const message = await expectRejection(() =>
      db.query(
        `insert into public.news_items (source, title, url, url_hash)
         values ('S', 'T', 'javascript:alert(1)', $1)`,
        ["b".repeat(64)],
      ),
    );

    expect(message).toMatch(/news_items_url_is_http/);
  });

  it("rejects a second brand_profile row", async () => {
    const message = await expectRejection(() =>
      db.query(
        `insert into public.brand_profile
           (id, business_name, business_description, audience_description,
            tone_instagram, tone_linkedin, tone_whatsapp)
         values (2, 'Other', 'd', 'a', 'i', 'l', 'w')`,
      ),
    );

    expect(message).toMatch(/brand_profile_singleton/);
  });

  it("rejects a failed generation run with no error text", async () => {
    const message = await expectRejection(() =>
      db.query(
        `insert into public.generation_runs (kind, status, finished_at)
         values ('daily_tip', 'failed', now())`,
      ),
    );

    expect(message).toMatch(/generation_runs_failure_has_reason/);
  });
});

describe("status transitions", () => {
  it.each([
    ["idea", "ready", "2026-10-01", true],
    ["idea", "skipped", "2026-10-02", true],
    ["ready", "posted", "2026-10-03", true],
    ["ready", "skipped", "2026-10-04", true],
    ["skipped", "ready", "2026-10-05", true],
    ["idea", "posted", "2026-10-06", false],
    ["skipped", "posted", "2026-10-07", false],
    ["posted", "skipped", "2026-10-08", false],
  ])("governs %s -> %s", async (from, to, scheduledDate, isLegal) => {
    const isStartHydrated = from === "ready" || from === "posted";

    const id = await insertContentItem(db, {
      scheduled_date: scheduledDate,
      status: from,
      ...(isStartHydrated ? hydratedFields() : {}),
      ...(from === "posted"
        ? {
            posted_at: "2026-09-01T10:00:00Z",
            posted_by: "rohit@apexoria.test",
          }
        : {}),
      ...(from === "skipped" ? { skip_reason: "Not needed" } : {}),
    });

    // $2 is bound as text throughout, then cast once, so Postgres deduces a
    // single parameter type.
    const update = () =>
      db.query(
        `update public.content_items
         set status       = $2::public.content_status,
             hook         = coalesce(hook, 'Hook'),
             caption      = coalesce(caption, 'Caption'),
             body         = coalesce(body, '{"slides":[]}'::jsonb),
             design_brief = coalesce(design_brief, '{"objective":"o"}'::jsonb),
             hydrated_at  = coalesce(hydrated_at, now()),
             posted_at    = case when $2::text = 'posted'
                              then coalesce(posted_at, now()) end,
             posted_by    = case when $2::text = 'posted'
                              then coalesce(posted_by, 'p@apexoria.test') end,
             skip_reason  = case when $2::text = 'skipped' then 'Reason' end
         where id = $1`,
        [id, to],
      );

    if (isLegal) {
      await expect(update()).resolves.toBeDefined();
      return;
    }

    const message = await expectRejection(update);

    expect(message).toMatch(/illegal status transition/);
  });

  it("allows un-ticking a posted item back to ready", async () => {
    const id = await insertContentItem(db, {
      scheduled_date: "2026-11-01",
      status: "posted",
      ...hydratedFields(),
      posted_at: "2026-09-01T10:00:00Z",
      posted_by: "rohit@apexoria.test",
    });

    await expect(
      db.query(
        `update public.content_items
         set status = 'ready', posted_at = null, posted_by = null
         where id = $1`,
        [id],
      ),
    ).resolves.toBeDefined();
  });

  it("refuses to modify the content of a posted item", async () => {
    const id = await insertContentItem(db, {
      scheduled_date: "2026-11-02",
      status: "posted",
      ...hydratedFields(),
      posted_at: "2026-09-01T10:00:00Z",
      posted_by: "rohit@apexoria.test",
    });

    const message = await expectRejection(() =>
      db.query("update public.content_items set caption = $1 where id = $2", [
        "Rewritten after posting",
        id,
      ]),
    );

    expect(message).toMatch(/content of a posted item cannot be modified/);
  });

  it("maintains updated_at on update", async () => {
    const id = await insertContentItem(db, { scheduled_date: "2026-11-03" });
    const before = await db.query(
      "select updated_at from public.content_items where id = $1",
      [id],
    );

    await db.query(
      "update public.content_items set idea = 'Revised idea' where id = $1",
      [id],
    );

    const after = await db.query(
      "select updated_at from public.content_items where id = $1",
      [id],
    );

    expect(after.rows[0].updated_at.getTime()).toBeGreaterThanOrEqual(
      before.rows[0].updated_at.getTime(),
    );
  });
});

describe("activity_log append-only", () => {
  let itemId;

  beforeAll(async () => {
    itemId = await insertContentItem(db, { scheduled_date: "2026-12-01" });
    await db.query(
      `insert into public.activity_log (content_item_id, action, to_value)
       values ($1, 'created', 'idea')`,
      [itemId],
    );
  });

  it("raises on UPDATE even as the table owner", async () => {
    const message = await expectRejection(() =>
      db.query("update public.activity_log set note = 'tampered'"),
    );

    expect(message).toMatch(/append-only/);
  });

  it("raises on DELETE even as the table owner", async () => {
    const message = await expectRejection(() =>
      db.query("delete from public.activity_log"),
    );

    expect(message).toMatch(/append-only/);
  });

  it("still accepts inserts", async () => {
    await expect(
      db.query(
        `insert into public.activity_log (content_item_id, action, note)
         values ($1, 'note_added', 'Posted to the batch group too')`,
        [itemId],
      ),
    ).resolves.toBeDefined();
  });
});

describe("idempotency (FR-5.3)", () => {
  it("rejects a duplicate plan_month", async () => {
    await db.query(
      "insert into public.content_plans (plan_month) values ('2027-01-01')",
    );

    const message = await expectRejection(() =>
      db.query(
        "insert into public.content_plans (plan_month) values ('2027-01-01')",
      ),
    );

    expect(message).toMatch(/content_plans_plan_month_key/);
  });

  it("rejects a duplicate tip_date", async () => {
    await db.query(
      "insert into public.daily_tips (tip_date, tip) values ('2027-02-01', 'A')",
    );

    const message = await expectRejection(() =>
      db.query(
        "insert into public.daily_tips (tip_date, tip) values ('2027-02-01', 'B')",
      ),
    );

    expect(message).toMatch(/daily_tips_tip_date_key/);
  });

  it("deduplicates news by url_hash", async () => {
    const hash = "c".repeat(64);

    await db.query(
      `insert into public.news_items (source, title, url, url_hash)
       values ('S', 'First', 'https://example.test/dup', $1)`,
      [hash],
    );

    const result = await db.query(
      `insert into public.news_items (source, title, url, url_hash)
       values ('S', 'Second', 'https://example.test/dup?utm_source=x', $1)
       on conflict (url_hash) do nothing
       returning id`,
      [hash],
    );

    expect(result.rows).toHaveLength(0);
  });

  it("rejects a blank tip", async () => {
    const message = await expectRejection(() =>
      db.query(
        "insert into public.daily_tips (tip_date, tip) values ('2027-03-01', '   ')",
      ),
    );

    expect(message).toMatch(/daily_tips_tip_not_blank/);
  });
});
