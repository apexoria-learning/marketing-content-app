// DATABASE.md §5.9–5.11, §7.3 — admin panel tables and usage attribution.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
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

async function asMember(email, operation) {
  return asRole(db, "authenticated", async () => {
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [
      JSON.stringify({ email }),
    ]);
    try {
      return await operation();
    } finally {
      await db.query(`select set_config('request.jwt.claims', '', false)`);
    }
  });
}

describeDatabase("app_users access list", () => {
  it("lets a member read only their own access row", async () => {
    await db.query(
      `insert into public.app_users (email, role) values
         ('self@apexoria.test', 'member'), ('other@apexoria.test', 'admin')`,
    );
    const rows = await asMember("Self@Apexoria.test", () =>
      db.query("select email, role from public.app_users"),
    );
    expect(rows.rows).toEqual([
      { email: "self@apexoria.test", role: "member" },
    ]);
  });

  it("never lets a signed-in account grant or elevate access itself", async () => {
    await asMember("self@apexoria.test", async () => {
      await expectRejection(() =>
        db.query(
          "insert into public.app_users (email, role) values ('intruder@example.test', 'admin')",
        ),
      );
      const updated = await db.query(
        "update public.app_users set role = 'admin' where email = 'self@apexoria.test' returning email",
      );
      expect(updated.rows).toHaveLength(0);
    });
    const role = await db.query(
      "select role from public.app_users where email = 'self@apexoria.test'",
    );
    expect(role.rows[0].role).toBe("member");
  });

  it("returns nothing to anon", async () => {
    const rows = await asRole(db, "anon", () =>
      db.query("select * from public.app_users"),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("rejects unnormalized emails and unknown roles", async () => {
    await expectRejection(() =>
      db.query(
        "insert into public.app_users (email) values (' Mixed@Apexoria.test')",
      ),
    );
    await expectRejection(() =>
      db.query(
        "insert into public.app_users (email, role) values ('owner2@apexoria.test', 'owner')",
      ),
    );
  });
});

describeDatabase("app_settings overrides", () => {
  it("seeds one readable singleton of env-default (null) overrides", async () => {
    const rows = await asMember("self@apexoria.test", () =>
      db.query(
        "select id, ai_generation_enabled, ai_model, enabled_pillars from public.app_settings",
      ),
    );
    expect(rows.rows).toEqual([
      {
        id: 1,
        ai_generation_enabled: null,
        ai_model: null,
        enabled_pillars: null,
      },
    ]);
    await expectRejection(() =>
      db.query("insert into public.app_settings (id) values (2)"),
    );
  });

  it("is not writable by members", async () => {
    await asMember("self@apexoria.test", async () => {
      const updated = await db.query(
        "update public.app_settings set ai_generation_enabled = true returning id",
      );
      expect(updated.rows).toHaveLength(0);
    });
  });

  it("rejects an unplannable pillar set and a non-HTTPS gateway", async () => {
    await expectRejection(() =>
      db.query(
        `update public.app_settings
         set enabled_pillars = array['salesforce_news', 'memes', 'salesforce_tips']::public.content_pillar[]`,
      ),
    );
    await expectRejection(() =>
      db.query(
        "update public.app_settings set ai_base_url = 'http://gateway.example.test/v1'",
      ),
    );
    await db.query(
      `update public.app_settings
       set enabled_pillars = array['memes', 'salesforce_tips', 'career_guidance']::public.content_pillar[],
           ai_base_url = 'https://gateway.example.test/v1'`,
    );
  });
});

describeDatabase("prompt_instructions history", () => {
  it("is readable by members, append-only and bounded", async () => {
    await db.query(
      `insert into public.prompt_instructions (scope, instructions, created_by)
       values ('content', 'Prefer Indian examples.', 'owner@apexoria.test')`,
    );
    const rows = await asMember("self@apexoria.test", () =>
      db.query("select scope, instructions from public.prompt_instructions"),
    );
    expect(rows.rows).toEqual([
      { scope: "content", instructions: "Prefer Indian examples." },
    ]);
    await asMember("self@apexoria.test", () =>
      expectRejection(() =>
        db.query(
          "insert into public.prompt_instructions (scope, instructions) values ('content', 'x')",
        ),
      ),
    );
    await expectRejection(() =>
      db.query("update public.prompt_instructions set instructions = 'x'"),
    );
    await expectRejection(() =>
      db.query("delete from public.prompt_instructions"),
    );
    await expectRejection(() =>
      db.query(
        "insert into public.prompt_instructions (scope, instructions) values ('content', $1)",
        ["x".repeat(2001)],
      ),
    );
  });
});

describeDatabase("generation run attribution", () => {
  it("stamps the caller's JWT email and ignores spoofed or rewritten values", async () => {
    const inserted = await asMember("Member@Apexoria.test", () =>
      db.query(
        `insert into public.generation_runs (kind, actor_email)
         values ('item_hydration', 'someone-else@example.test')
         returning id, actor_email`,
      ),
    );
    expect(inserted.rows[0].actor_email).toBe("member@apexoria.test");
    await asMember("member@apexoria.test", () =>
      db.query(
        "update public.generation_runs set actor_email = 'spoof@example.test' where id = $1",
        [inserted.rows[0].id],
      ),
    );
    const stored = await db.query(
      "select actor_email from public.generation_runs where id = $1",
      [inserted.rows[0].id],
    );
    expect(stored.rows[0].actor_email).toBe("member@apexoria.test");
  });

  it("leaves scheduled runs without a JWT email unattributed", async () => {
    const inserted = await db.query(
      "insert into public.generation_runs (kind) values ('news_ingest') returning actor_email",
    );
    expect(inserted.rows[0].actor_email).toBeNull();
  });
});
