// DATABASE.md §5.1 — industry-neutral, admin-managed business profile (0018).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigration,
  asRole,
  createTestDatabase,
  dropTestDatabase,
  expectRejection,
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

describeDatabase("business profile fields", () => {
  it("backfills today's Salesforce wording so prompts keep their meaning", async () => {
    const result = await db.query(
      "select industry, offerings_label, tip_topic from public.brand_profile",
    );
    expect(result.rows).toEqual([
      {
        industry: "Salesforce training",
        offerings_label: "Courses",
        tip_topic: "Salesforce learning",
      },
    ]);
  });

  it("rejects blank or untrimmed profile wording", async () => {
    for (const change of [
      "industry = ''",
      "industry = ' Python '",
      "offerings_label = repeat('x', 31)",
      "tip_topic = ''",
    ])
      expect(
        await expectRejection(() =>
          db.query(`update public.brand_profile set ${change} where id = 1`),
        ),
      ).toMatch(/brand_profile_\w+_bounded/);
  });
});

describeDatabase("business profile access", () => {
  it("lets members read the profile but no longer change it", async () => {
    await asRole(db, "authenticated", async () => {
      const read = await db.query(
        "select business_name from public.brand_profile",
      );
      expect(read.rows).toHaveLength(1);
      const updated = await db.query(
        "update public.brand_profile set business_name = 'Hijacked' returning id",
      );
      expect(updated.rows).toHaveLength(0);
    });
    const anon = await asRole(db, "anon", () =>
      db.query("select * from public.brand_profile"),
    );
    expect(anon.rows).toHaveLength(0);
  });

  it("lets the admin module (service_role) edit it", async () => {
    await asRole(db, "service_role", () =>
      db.query(
        `update public.brand_profile
         set industry = 'Python training', offerings_label = 'Programs',
             courses = array['Python Basics'], updated_by = 'admin@example.test'
         where id = 1`,
      ),
    );
    const result = await db.query(
      "select industry, offerings_label, courses, updated_by from public.brand_profile",
    );
    expect(result.rows[0]).toEqual({
      industry: "Python training",
      offerings_label: "Programs",
      courses: ["Python Basics"],
      updated_by: "admin@example.test",
    });
  });
});

describeDatabase("upgrading an edited profile", () => {
  it("keeps team edits and only adds the new fields", async () => {
    const legacy = await createTestDatabase({
      until: "0017_pillar_catalogue.sql",
    });
    try {
      await legacy.query(
        "update public.brand_profile set business_name = 'Renamed Co' where id = 1",
      );
      await applyMigration(legacy, "0018_business_profile.sql");
      const result = await legacy.query(
        "select business_name, industry, array_length(courses, 1) as offerings from public.brand_profile",
      );
      expect(result.rows[0]).toEqual({
        business_name: "Renamed Co",
        industry: "Salesforce training",
        offerings: 6,
      });
    } finally {
      await dropTestDatabase(legacy);
    }
  }, 120_000);
});
