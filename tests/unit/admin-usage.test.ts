import { describe, expect, it } from "vitest";
import {
  summarizeUsage,
  usageWindowStart,
  type UsageRun,
} from "../../src/lib/utils/usage-summary";
import {
  buildUserDirectory,
  summarizeUserBase,
} from "../../src/lib/utils/user-directory";

const now = new Date("2026-11-03T08:00:00Z"); // 13:30 IST

function run(overrides: Partial<UsageRun>): UsageRun {
  return {
    started_at: "2026-11-03T04:00:00Z",
    kind: "item_hydration",
    status: "success",
    input_tokens: 100,
    output_tokens: 50,
    actor_email: "a@example.test",
    ...overrides,
  };
}

describe("usage summary", () => {
  it("starts the window at IST midnight 29 days before today", () => {
    expect(usageWindowStart(now)).toBe("2026-10-05T00:00:00+05:30");
  });

  it("totals tokens by person, day and type using IST dates", () => {
    const summary = summarizeUsage(
      [
        run({}),
        // 2026-11-02 19:00 UTC is already 3 Nov in IST.
        run({
          started_at: "2026-11-02T19:00:00Z",
          actor_email: "B@example.test",
        }),
        run({
          started_at: "2026-11-01T04:00:00Z",
          kind: "month_skeleton",
          status: "failed",
          input_tokens: null,
          output_tokens: null,
        }),
        run({ actor_email: null, input_tokens: 1000, output_tokens: 0 }),
        run({ started_at: "2026-09-01T04:00:00Z" }),
      ],
      now,
    );
    expect(summary.totals).toEqual({
      runs: 4,
      failed: 1,
      input_tokens: 1200,
      output_tokens: 100,
    });
    expect(summary.today).toMatchObject({ runs: 3, input_tokens: 1200 });
    expect(summary.by_day.map((day) => day.date)).toEqual([
      "2026-11-03",
      "2026-11-01",
    ]);
    expect(summary.by_user.map((user) => user.email)).toEqual([
      null,
      "a@example.test",
      "b@example.test",
    ]);
    expect(summary.by_kind[0]).toMatchObject({
      kind: "item_hydration",
      runs: 3,
    });
  });

  it("returns empty groups when there is no usage", () => {
    expect(summarizeUsage([], now)).toMatchObject({
      totals: { runs: 0, input_tokens: 0 },
      by_day: [],
      by_user: [],
    });
  });
});

describe("user directory", () => {
  const record = (email: string, overrides = {}) => ({
    email,
    role: "member" as const,
    is_active: true,
    can_generate: true,
    created_at: "2026-10-01T00:00:00Z",
    created_by: "owner@example.test",
    updated_at: "2026-10-01T00:00:00Z",
    updated_by: "owner@example.test",
    ...overrides,
  });

  const entries = buildUserDirectory({
    ownerEmails: "owner@example.test",
    allowedEmails: "legacy@example.test",
    records: [
      record("granted@example.test", { role: "admin", can_generate: false }),
      record("revoked@example.test", { is_active: false }),
    ],
    accounts: [
      {
        email: "Granted@Example.test",
        name: "Asha",
        created_at: null,
        last_sign_in_at: "2026-10-01T00:00:00Z",
      },
      {
        email: "stranger@example.test",
        name: null,
        created_at: null,
        last_sign_in_at: "2026-11-02T00:00:00Z",
      },
    ],
    runs: [run({ actor_email: "granted@example.test" })],
    activity: [
      {
        actor_email: "legacy@example.test",
        created_at: "2026-10-20T00:00:00Z",
      },
    ],
  });
  const byEmail = Object.fromEntries(
    entries.map((entry) => [entry.email, entry]),
  );

  it("lists owners, grants, legacy entries, revocations and denied sign-ins", () => {
    expect(entries.map((entry) => [entry.email, entry.access])).toEqual([
      ["granted@example.test", "granted"],
      ["legacy@example.test", "environment"],
      ["owner@example.test", "owner"],
      ["revoked@example.test", "revoked"],
      ["stranger@example.test", "no_access"],
    ]);
    expect(byEmail["granted@example.test"]).toMatchObject({
      name: "Asha",
      role: "admin",
      can_generate: false,
      runs: 1,
      tokens: 150,
      last_active_at: "2026-11-03T04:00:00Z",
    });
  });

  it("counts active people among those with access only", () => {
    expect(summarizeUserBase(entries, now)).toEqual({
      with_access: 3,
      active_7d: 1,
      active_30d: 2,
      awaiting_access: 1,
      revoked: 1,
    });
  });
});
