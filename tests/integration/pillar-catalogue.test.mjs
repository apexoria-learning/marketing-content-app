// DATABASE.md §5.14 — admin-managed pillar catalogue.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigration,
  asRole,
  createTestDatabase,
  dropTestDatabase,
  expectRejection,
  hydratedFields,
  insertContentItem,
  isDatabaseReachable,
} from "./support/database.mjs";

const canRun = await isDatabaseReachable();
const describeDatabase = describe.skipIf(!canRun);

let db;

beforeAll(async () => {
  if (canRun) {
    db = await createTestDatabase();
  }
}, 120_000);

afterAll(async () => {
  await dropTestDatabase(db);
});

const save = (pillar, create) =>
  db.query(
    "select public.save_pillar($1::jsonb, $2, 'admin@example.test') as result",
    [JSON.stringify(pillar), create],
  );

const pythonTips = {
  key: "python_tips",
  label: "Python",
  description: "Small, practical Python lessons",
  guidance: "",
  requires_news: false,
  is_enabled: true,
};

function readyFields(overrides = {}) {
  const fields = hydratedFields();
  return {
    status: "ready",
    hook: fields.hook,
    caption: fields.caption,
    body: fields.body,
    design_brief: fields.design_brief,
    hydrated_at: fields.hydrated_at,
    ...overrides,
  };
}

describeDatabase("pillar catalogue seed", () => {
  it("seeds today's ten pillars with labels, intents and the news flag", async () => {
    const result = await db.query(
      `select key, label, requires_news, is_enabled
       from public.pillars order by sort_order`,
    );
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0]).toEqual({
      key: "salesforce_tips",
      label: "Tips",
      requires_news: false,
      is_enabled: true,
    });
    expect(
      result.rows.filter((row) => row.requires_news).map((row) => row.key),
    ).toEqual(["salesforce_news"]);
  });

  it("lets members read the catalogue but never change it", async () => {
    await asRole(db, "authenticated", async () => {
      expect(
        (await db.query("select key from public.pillars")).rows,
      ).toHaveLength(10);
      await expectRejection(() =>
        db.query(
          "insert into public.pillars (key, label, description) values ('hacks', 'Hacks', 'x')",
        ),
      );
      const updated = await db.query(
        "update public.pillars set is_enabled = false returning key",
      );
      expect(updated.rows).toHaveLength(0);
      await expectRejection(() =>
        save({ ...pythonTips, key: "member_pillar" }, true),
      );
    });
    const anon = await asRole(db, "anon", () =>
      db.query("select * from public.pillars"),
    );
    expect(anon.rows).toHaveLength(0);
  });

  it("keeps keys stable and retires instead of deleting", async () => {
    await expectRejection(() =>
      db.query(
        "update public.pillars set key = 'tips' where key = 'salesforce_tips'",
      ),
    );
    await expectRejection(() =>
      db.query("delete from public.pillars where key = 'memes'"),
    );
    await expectRejection(() =>
      db.query(
        "insert into public.pillars (key, label, description) values ('empty_intent', 'Empty', '')",
      ),
    );
  });
});

describeDatabase("content rules from the pillar catalogue", () => {
  it("accepts a new admin-added pillar and rejects unknown ones", async () => {
    await asRole(db, "service_role", () => save(pythonTips, true));
    await expect(
      insertContentItem(db, {
        scheduled_date: "2027-03-01",
        pillar: "python_tips",
      }),
    ).resolves.toBeDefined();
    await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2027-03-02",
        pillar: "no_such_pillar",
      }),
    );
  });

  it("requires sources for any pillar flagged as news, not just salesforce_news", async () => {
    await asRole(db, "service_role", () =>
      save(
        {
          ...pythonTips,
          key: "python_news",
          label: "Py news",
          description: "Python releases",
          requires_news: true,
        },
        true,
      ),
    );
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2027-03-03",
        pillar: "python_news",
        ...readyFields(),
      }),
    );
    expect(message).toMatch(/News content requires a source/);
    await expect(
      insertContentItem(db, {
        scheduled_date: "2027-03-04",
        pillar: "python_news",
        ...readyFields({
          source_refs: JSON.stringify([
            { title: "Release", url: "https://example.test/a", source: "PSF" },
          ]),
        }),
      }),
    ).resolves.toBeDefined();
  });

  it("blocks new content on a retired pillar but keeps existing content editable", async () => {
    const itemId = await insertContentItem(db, {
      scheduled_date: "2027-03-05",
      pillar: "python_tips",
    });
    await asRole(db, "service_role", () =>
      save({ ...pythonTips, is_enabled: false }, false),
    );
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2027-03-06",
        pillar: "python_tips",
      }),
    );
    expect(message).toMatch(/Pillar is disabled/);
    await db.query(
      "update public.content_items set idea = 'Edited idea' where id = $1",
      [itemId],
    );
  });

  it("lets the planners insert a catalogue pillar beyond the original ten", async () => {
    await asRole(db, "service_role", () =>
      save(
        {
          ...pythonTips,
          key: "py_jobs",
          label: "Py jobs",
          description: "Python career moves",
        },
        true,
      ),
    );
    const result = await asRole(db, "authenticated", () =>
      db.query(
        "select public.commit_day_items($1::date, $2::jsonb, 'day-plan-v2') as result",
        [
          "2027-04-07",
          JSON.stringify([
            {
              platform: "instagram",
              format: "post",
              pillar: "py_jobs",
              idea: "Breaking into Python roles",
            },
          ]),
        ],
      ),
    );
    expect(result.rows[0].result.item_ids).toHaveLength(1);
  });
});

describeDatabase("upgrading from the enabled-pillars filter", () => {
  it("folds app_settings.enabled_pillars into is_enabled and keeps the old column", async () => {
    const legacy = await createTestDatabase({
      until: "0016_platform_catalogue.sql",
    });
    try {
      await legacy.query(
        `update public.app_settings
         set enabled_pillars = array['memes', 'salesforce_tips', 'career_guidance']::public.content_pillar[]
         where id = 1`,
      );
      await applyMigration(legacy, "0017_pillar_catalogue.sql");
      const enabled = await legacy.query(
        "select key from public.pillars where is_enabled order by sort_order",
      );
      expect(enabled.rows.map((row) => row.key)).toEqual([
        "salesforce_tips",
        "memes",
        "career_guidance",
      ]);
      const settings = await legacy.query(
        "select enabled_pillars::text[] as pillars from public.app_settings where id = 1",
      );
      expect(settings.rows[0].pillars).toEqual([
        "memes",
        "salesforce_tips",
        "career_guidance",
      ]);

      // The previous release keeps writing the old filter until deploy.
      await legacy.query(
        `update public.app_settings
         set enabled_pillars = array['memes', 'salesforce_tips', 'myth_busting', 'salesforce_news']::public.content_pillar[]
         where id = 1`,
      );
      const synced = await legacy.query(
        "select key from public.pillars where is_enabled order by sort_order",
      );
      expect(synced.rows.map((row) => row.key)).toEqual([
        "salesforce_tips",
        "salesforce_news",
        "memes",
        "myth_busting",
      ]);
      await legacy.query(
        "update public.app_settings set enabled_pillars = null where id = 1",
      );
      const reset = await legacy.query(
        "select count(*)::int as count from public.pillars where is_enabled",
      );
      expect(reset.rows[0].count).toBe(10);
    } finally {
      await dropTestDatabase(legacy);
    }
  }, 120_000);

  it("keeps existing content on the original keys", async () => {
    const legacy = await createTestDatabase({
      until: "0016_platform_catalogue.sql",
    });
    try {
      await insertContentItem(legacy, { pillar: "salesforce_news" });
      await applyMigration(legacy, "0017_pillar_catalogue.sql");
      const rows = await legacy.query(
        "select pillar, pg_typeof(pillar)::text as type from public.content_items",
      );
      expect(rows.rows).toEqual([{ pillar: "salesforce_news", type: "text" }]);
    } finally {
      await dropTestDatabase(legacy);
    }
  }, 120_000);
});

describeDatabase("save_pillar plannability", () => {
  it("refuses fewer than three enabled pillars that do not need news, changing nothing", async () => {
    await db.query(
      `update public.pillars set is_enabled = false
       where key not in ('salesforce_tips', 'memes', 'salesforce_news')`,
    );
    const message = await expectRejection(() =>
      asRole(db, "service_role", () =>
        save(
          {
            key: "memes",
            label: "Meme",
            description: "Relatable humour, reach driver",
            guidance: "",
            requires_news: false,
            is_enabled: true,
          },
          false,
        ),
      ),
    );
    expect(message).toMatch(/At least three enabled pillars/);
    await db.query("update public.pillars set is_enabled = true");
  });

  it("refuses more than fourteen enabled pillars", async () => {
    const count = await db.query(
      "select count(*)::int as count from public.pillars where is_enabled",
    );
    for (let index = count.rows[0].count; index < 14; index++)
      await asRole(db, "service_role", () =>
        save(
          { ...pythonTips, key: `extra_${index}`, label: `Extra ${index}` },
          true,
        ),
      );
    const message = await expectRejection(() =>
      asRole(db, "service_role", () =>
        save({ ...pythonTips, key: "one_too_many", label: "Too many" }, true),
      ),
    );
    expect(message).toMatch(/At most fourteen pillars/);
    const stored = await db.query(
      "select count(*)::int as count from public.pillars where key = 'one_too_many'",
    );
    expect(stored.rows[0].count).toBe(0);
  });
});
