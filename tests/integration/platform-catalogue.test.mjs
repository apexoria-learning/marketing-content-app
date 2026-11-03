// DATABASE.md §5.12–5.13 — admin-managed platform catalogue.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
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

async function addPlatform(key, overrides = {}) {
  const row = {
    label: "Threads",
    colour_slot: 4,
    icon: "chat",
    allows_hashtags: true,
    max_hashtags: 2,
    is_enabled: true,
    ...overrides,
  };
  await db.query(
    `insert into public.platforms
       (key, label, colour_slot, icon, allows_hashtags, max_hashtags, is_enabled)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      key,
      row.label,
      row.colour_slot,
      row.icon,
      row.allows_hashtags,
      row.max_hashtags,
      row.is_enabled,
    ],
  );
  await db.query(
    "insert into public.platform_formats (platform_key, format) values ($1, 'post')",
    [key],
  );
}

describeDatabase("platform catalogue seed", () => {
  it("seeds today's three platforms with their exact format rules and tones", async () => {
    const platforms = await db.query(
      `select key, allows_hashtags, max_hashtags, is_enabled, tone <> '' as has_tone
       from public.platforms order by sort_order`,
    );
    expect(platforms.rows).toEqual([
      {
        key: "instagram",
        allows_hashtags: true,
        max_hashtags: 30,
        is_enabled: true,
        has_tone: true,
      },
      {
        key: "linkedin",
        allows_hashtags: true,
        max_hashtags: 30,
        is_enabled: true,
        has_tone: true,
      },
      {
        key: "whatsapp",
        allows_hashtags: false,
        max_hashtags: 0,
        is_enabled: true,
        has_tone: true,
      },
    ]);
    const formats = await db.query(
      `select platform_key, array_agg(format::text order by format::text) as formats
       from public.platform_formats group by platform_key order by platform_key`,
    );
    expect(formats.rows).toEqual([
      {
        platform_key: "instagram",
        formats: ["carousel", "meme", "poll", "post", "reel", "story"],
      },
      { platform_key: "linkedin", formats: ["carousel", "poll", "post"] },
      { platform_key: "whatsapp", formats: ["meme", "story"] },
    ]);
  });

  it("lets members read the catalogue but never change it", async () => {
    await asRole(db, "authenticated", async () => {
      const rows = await db.query("select key from public.platforms");
      expect(rows.rows).toHaveLength(3);
      await expectRejection(() =>
        db.query(
          "insert into public.platforms (key, label, colour_slot, icon) values ('x_app', 'X', 4, 'chat')",
        ),
      );
      const updated = await db.query(
        "update public.platforms set is_enabled = false returning key",
      );
      expect(updated.rows).toHaveLength(0);
      await expectRejection(() =>
        db.query(
          "insert into public.platform_formats (platform_key, format) values ('linkedin', 'reel')",
        ),
      );
    });
    const anon = await asRole(db, "anon", () =>
      db.query("select * from public.platforms"),
    );
    expect(anon.rows).toHaveLength(0);
  });

  it("keeps keys stable and retires instead of deleting", async () => {
    await expectRejection(() =>
      db.query(
        "update public.platforms set key = 'insta' where key = 'instagram'",
      ),
    );
    await expectRejection(() =>
      db.query("delete from public.platforms where key = 'whatsapp'"),
    );
    await expectRejection(() =>
      db.query(
        "insert into public.platforms (key, label, colour_slot, icon) values ('Bad Key', 'Bad', 1, 'chat')",
      ),
    );
    await expectRejection(() =>
      db.query(
        "insert into public.platforms (key, label, colour_slot, icon, allows_hashtags, max_hashtags) values ('nohash', 'No', 1, 'chat', false, 3)",
      ),
    );
  });
});

describeDatabase("content rules from the catalogue", () => {
  it("accepts content on a newly added platform only with an enabled format", async () => {
    await addPlatform("threads");
    await expect(
      insertContentItem(db, {
        scheduled_date: "2027-01-04",
        platform: "threads",
        format: "post",
      }),
    ).resolves.toBeDefined();
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2027-01-05",
        platform: "threads",
        format: "reel",
      }),
    );
    expect(message).toMatch(/Format is not enabled for this platform/);
    await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2027-01-06",
        platform: "myspace",
        format: "post",
      }),
    );
  });

  it("enforces each platform's hashtag limit", async () => {
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2027-01-07",
        platform: "threads",
        format: "post",
        hashtags: "{#a,#b,#c}",
      }),
    );
    expect(message).toMatch(/Too many hashtags for this platform/);
  });

  it("blocks new content on a retired platform but keeps existing content editable", async () => {
    const itemId = await insertContentItem(db, {
      scheduled_date: "2027-01-08",
      platform: "threads",
      format: "post",
    });
    await db.query(
      "update public.platforms set is_enabled = false, max_hashtags = 0 where key = 'threads'",
    );
    const message = await expectRejection(() =>
      insertContentItem(db, {
        scheduled_date: "2027-01-09",
        platform: "threads",
        format: "post",
      }),
    );
    expect(message).toMatch(/Platform is disabled/);
    const fields = hydratedFields();
    await db.query(
      `update public.content_items
       set status = 'ready', hook = $2, caption = $3, body = $4::jsonb,
           design_brief = $5::jsonb, hydrated_at = $6
       where id = $1`,
      [
        itemId,
        fields.hook,
        fields.caption,
        fields.body,
        fields.design_brief,
        fields.hydrated_at,
      ],
    );
    const status = await db.query(
      "select status from public.content_items where id = $1",
      [itemId],
    );
    expect(status.rows[0].status).toBe("ready");
  });

  it("lets the day planner insert a catalogue platform beyond the original three", async () => {
    await addPlatform("youtube_shorts", { label: "YouTube Shorts" });
    const result = await asRole(db, "authenticated", () =>
      db.query(
        "select public.commit_day_items($1::date, $2::jsonb, 'day-plan-v1') as result",
        [
          "2027-02-03",
          JSON.stringify([
            {
              platform: "youtube_shorts",
              format: "post",
              pillar: "memes",
              idea: "A short idea",
            },
          ]),
        ],
      ),
    );
    expect(result.rows[0].result.item_ids).toHaveLength(1);
  });
});

describeDatabase("save_platform admin writer", () => {
  const base = {
    label: "Pinterest",
    is_enabled: true,
    colour_slot: 5,
    icon: "globe",
    allows_hashtags: true,
    max_hashtags: 5,
    caption_max_chars: 500,
    tone: "Visual and calm",
    guidance: "",
  };
  const save = (platform, formats, create) =>
    db.query(
      "select public.save_platform($1::jsonb, $2::public.content_format[], $3, 'admin@example.test') as result",
      [JSON.stringify(platform), formats, create],
    );

  it("is not executable by members", async () => {
    await asRole(db, "authenticated", () =>
      expectRejection(() =>
        save({ ...base, key: "pinterest" }, ["post"], true),
      ),
    );
  });

  it("creates a platform with its formats, then replaces formats atomically", async () => {
    await asRole(db, "service_role", () =>
      save({ ...base, key: "pinterest" }, ["post", "carousel"], true),
    );
    await asRole(db, "service_role", () =>
      save({ ...base, key: "pinterest", label: "Pins" }, ["story"], false),
    );
    const row = await db.query(
      `select p.label, p.created_by, array_agg(f.format::text) as formats
       from public.platforms p join public.platform_formats f on f.platform_key = p.key
       where p.key = 'pinterest' group by p.label, p.created_by`,
    );
    expect(row.rows).toEqual([
      { label: "Pins", created_by: "admin@example.test", formats: ["story"] },
    ]);
  });

  it("refuses to leave fewer than two enabled platform formats, changing nothing", async () => {
    await db.query("update public.platforms set is_enabled = false");
    const message = await expectRejection(() =>
      asRole(db, "service_role", () =>
        save({ ...base, key: "pinterest" }, ["story"], false),
      ),
    );
    expect(message).toMatch(/At least two enabled platform formats/);
    const formats = await db.query(
      "select count(*)::int as count from public.platform_formats where platform_key = 'pinterest'",
    );
    expect(formats.rows[0].count).toBe(1);
    await db.query("update public.platforms set is_enabled = true");
  });
});
