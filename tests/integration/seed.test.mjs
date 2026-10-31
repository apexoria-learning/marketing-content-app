// IMPLEMENTATION-PLAN Task 2.10 — the dev seed must exercise every UI state
// in DESIGN.md §9.2 before Phase 6 begins, plus the brand profile from 0009.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "./support/database.mjs";

let db;

beforeAll(async () => {
  db = await createTestDatabase({ seed: true });
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function rows(sql, params) {
  return (await db.query(sql, params)).rows;
}

describe("brand profile (migration 0009)", () => {
  it("holds genuine Apexoria content", async () => {
    const [profile] = await rows("select * from public.brand_profile");

    expect(profile.business_name).toBe("Apexoria Learning");
    expect(profile.business_description).toMatch(/Salesforce/);
    expect(profile.audience_description).toMatch(/career switchers/i);
    expect(profile.links.website).toBe("https://www.apexorialearning.in");
  });

  it("lists the six real courses", async () => {
    const [profile] = await rows("select courses from public.brand_profile");

    expect(profile.courses).toEqual([
      "Salesforce Foundation",
      "Salesforce Crash Course",
      "Salesforce Complete Course",
      "Salesforce QA",
      "Automation QA",
      "Salesforce Interview Prep",
    ]);
  });

  it("carries per-platform tone rules and do/don't lists (D12, FR-8.2)", async () => {
    const [profile] = await rows("select * from public.brand_profile");

    expect(profile.tone_instagram).not.toBe(profile.tone_linkedin);
    expect(profile.tone_whatsapp).toMatch(/hashtag/i);
    expect(profile.do_list.length).toBeGreaterThanOrEqual(5);
    expect(profile.dont_list.length).toBeGreaterThanOrEqual(5);
  });

  it("contains no placeholder content", async () => {
    const [profile] = await rows("select * from public.brand_profile");
    const authored = [
      profile.business_name,
      profile.business_description,
      profile.audience_description,
      profile.tone_instagram,
      profile.tone_linkedin,
      profile.tone_whatsapp,
      ...profile.courses,
    ].join(" ");

    expect(authored).not.toMatch(/lorem|ipsum|TBD|TODO|XXX|sample text/i);
  });

  it("is idempotent — re-applying 0009 does not overwrite edits", async () => {
    await db.query(
      "update public.brand_profile set business_name = 'Edited In Settings' where id = 1",
    );

    const migration = await readFile(
      path.resolve("supabase", "migrations", "0009_seed_brand_profile.sql"),
      "utf8",
    );

    await db.exec(migration);

    const [profile] = await rows(
      "select business_name from public.brand_profile",
    );

    expect(profile.business_name).toBe("Edited In Settings");

    await db.query(
      "update public.brand_profile set business_name = 'Apexoria Learning' where id = 1",
    );
  });
});

describe("content coverage", () => {
  it("covers all three platforms", async () => {
    const result = await rows(
      "select distinct platform from public.content_items order by platform",
    );

    expect(result.map((row) => row.platform)).toEqual([
      "instagram",
      "linkedin",
      "whatsapp",
    ]);
  });

  it("covers all six formats", async () => {
    const result = await rows(
      "select distinct format from public.content_items",
    );

    expect(result.map((row) => row.format).sort()).toEqual([
      "carousel",
      "meme",
      "poll",
      "post",
      "reel",
      "story",
    ]);
  });

  it("covers all ten pillars (M4)", async () => {
    const result = await rows(
      "select distinct pillar from public.content_items",
    );

    expect(result).toHaveLength(10);
  });

  it("covers all four statuses", async () => {
    const result = await rows(
      "select distinct status from public.content_items",
    );

    expect(result.map((row) => row.status).sort()).toEqual([
      "idea",
      "posted",
      "ready",
      "skipped",
    ]);
  });
});

describe("edge cases the UI must handle (DESIGN.md §9.2)", () => {
  it("includes an overdue unposted item", async () => {
    const result = await rows(
      `select id from public.content_items
       where scheduled_date < current_date and status in ('idea', 'ready')`,
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it("includes an un-hydrated idea item", async () => {
    const result = await rows(
      `select id from public.content_items
       where status = 'idea' and hydrated_at is null and caption is null`,
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it("includes a day holding two items", async () => {
    const result = await rows(
      `select scheduled_date from public.content_items
       group by scheduled_date having count(*) = 2`,
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it("includes an empty day inside the planned window", async () => {
    const result = await rows(
      `select d::date as day
       from generate_series(
         (select min(scheduled_date) from public.content_items),
         (select max(scheduled_date) from public.content_items),
         interval '1 day'
       ) as d
       where not exists (
         select 1 from public.content_items ci where ci.scheduled_date = d::date
       )`,
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it("includes a skipped item carrying a reason", async () => {
    const result = await rows(
      `select skip_reason from public.content_items
       where status = 'skipped' and skip_reason is not null`,
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it("includes a sourceless non-news item", async () => {
    const result = await rows(
      `select id from public.content_items
       where pillar <> 'salesforce_news'
         and status in ('ready', 'posted')
         and jsonb_array_length(source_refs) = 0`,
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it("gives today at least one item to act on", async () => {
    const result = await rows(
      `select status from public.content_items
       where scheduled_date = current_date order by slot`,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((row) => row.status !== "posted")).toBe(true);
  });

  it("gives the archive posted history to show", async () => {
    const result = await rows(
      "select id from public.content_items where status = 'posted'",
    );

    expect(result.length).toBeGreaterThanOrEqual(10);
  });
});

describe("payload integrity", () => {
  it("fully hydrates every ready and posted item", async () => {
    const result = await rows(
      `select id from public.content_items
       where status in ('ready', 'posted')
         and (hook is null or caption is null or body is null
              or design_brief is null or hydrated_at is null)`,
    );

    expect(result).toHaveLength(0);
  });

  it("sources every hydrated news item (FR-3.5, US-12)", async () => {
    const result = await rows(
      `select id from public.content_items
       where pillar = 'salesforce_news'
         and status in ('ready', 'posted')
         and jsonb_array_length(source_refs) = 0`,
    );

    expect(result).toHaveLength(0);
  });

  it("gives carousels numbered slides and reels timed scenes", async () => {
    const [carousel] = await rows(
      `select body from public.content_items
       where format = 'carousel' and status in ('ready', 'posted') limit 1`,
    );
    const [reel] = await rows(
      `select body from public.content_items
       where format = 'reel' and status in ('ready', 'posted') limit 1`,
    );

    expect(carousel.body.slides.length).toBeGreaterThanOrEqual(5);
    expect(carousel.body.slides[0]).toHaveProperty("headline");
    expect(reel.body.scenes[0]).toHaveProperty("on_screen_text");
  });

  // jsonb does not preserve key insertion order, so the fixed subsection
  // *order* in DESIGN.md §6.3 is a rendering concern for Phase 5. What the
  // payload must guarantee is that every subsection is present.
  it("gives every design brief all seven subsections (DESIGN.md §6.3)", async () => {
    const result = await rows(
      `select design_brief from public.content_items
       where design_brief is not null`,
    );

    expect(result.length).toBeGreaterThan(0);

    for (const row of result) {
      expect(Object.keys(row.design_brief).sort()).toEqual([
        "layout_notes",
        "must_avoid",
        "must_include",
        "objective",
        "specs",
        "typography",
        "visual_direction",
      ]);
      expect(row.design_brief.specs).toHaveProperty("dimensions");
    }
  });

  it("respects per-platform hashtag rules (PRD §6.3)", async () => {
    const result = await rows(
      `select platform, cardinality(hashtags) as tag_count
       from public.content_items where status in ('ready', 'posted')`,
    );

    for (const row of result) {
      if (row.platform === "whatsapp") {
        expect(row.tag_count).toBe(0);
      } else if (row.platform === "linkedin") {
        expect(row.tag_count).toBeLessThanOrEqual(5);
      } else {
        expect(row.tag_count).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("attaches every item to the planned month", async () => {
    const result = await rows(
      "select id from public.content_items where plan_id is null",
    );

    expect(result).toHaveLength(0);
  });
});

describe("supporting fixtures", () => {
  it("seeds about twenty news items with valid SHA-256 hashes", async () => {
    const result = await rows(`select url, url_hash from public.news_items`);

    expect(result.length).toBe(20);

    for (const row of result) {
      expect(row.url_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.url).toMatch(/^https:\/\//);
    }
  });

  it("derives the hash from the URL so ingest deduplicates (FR-3.2)", async () => {
    const result = await rows(
      `select count(*)::int as mismatches from public.news_items
       where url_hash <> encode(sha256(convert_to(url, 'UTF8')), 'hex')`,
    );

    expect(result[0].mismatches).toBe(0);
  });

  it("seeds thirty daily tips including today's (FR-4.1, FR-4.3)", async () => {
    const all = await rows("select tip_date from public.daily_tips");
    const today = await rows(
      "select tip from public.daily_tips where tip_date = current_date",
    );

    expect(all.length).toBe(30);
    expect(today).toHaveLength(1);
  });

  it("seeds a run log including a partial failure for the banner", async () => {
    const result = await rows(
      "select status, error from public.generation_runs order by started_at",
    );

    expect(result.length).toBe(5);
    expect(
      result.some((row) => row.status === "partial" && row.error !== null),
    ).toBe(true);
  });

  it("seeds activity history for every posted item", async () => {
    const result = await rows(
      `select ci.id from public.content_items ci
       where ci.status = 'posted'
         and not exists (
           select 1 from public.activity_log al
           where al.content_item_id = ci.id and al.action = 'status_changed'
         )`,
    );

    expect(result).toHaveLength(0);
  });
});

describe("re-running the seed", () => {
  it("duplicates nothing", async () => {
    const before = await rows(
      `select
         (select count(*) from public.content_items)   as items,
         (select count(*) from public.news_items)      as news,
         (select count(*) from public.daily_tips)      as tips,
         (select count(*) from public.content_plans)   as plans,
         (select count(*) from public.activity_log)    as activity,
         (select count(*) from public.generation_runs) as runs`,
    );

    await db.exec(await readFile(path.resolve("supabase", "seed.sql"), "utf8"));

    const after = await rows(
      `select
         (select count(*) from public.content_items)   as items,
         (select count(*) from public.news_items)      as news,
         (select count(*) from public.daily_tips)      as tips,
         (select count(*) from public.content_plans)   as plans,
         (select count(*) from public.activity_log)    as activity,
         (select count(*) from public.generation_runs) as runs`,
    );

    expect(after[0]).toEqual(before[0]);
  });
});
