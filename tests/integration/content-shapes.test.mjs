import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ContentItemSchema,
  DailyTipSchema,
  MonthSkeletonSchema,
} from "../../src/lib/schemas/content.ts";
import {
  createTestDatabase,
  dropTestDatabase,
  isDatabaseReachable,
} from "./support/database.mjs";
const canRun = await isDatabaseReachable();
let db;
beforeAll(async () => {
  if (canRun) db = await createTestDatabase({ seed: true });
}, 120_000);
afterAll(async () => {
  await dropTestDatabase(db);
});
describe.skipIf(!canRun)(
  "domain schemas against actual migrated seed rows",
  () => {
    it("validates every content row and all six body formats", async () => {
      const { rows } = await db.query(
        "select to_jsonb(item) as item from public.content_items item",
      );
      const items = rows.map(({ item }) => ContentItemSchema.parse(item));
      expect(new Set(items.map((item) => item.format)).size).toBe(6);
      expect(new Set(items.map((item) => item.status)).size).toBe(4);
    });
    it("validates tips and month skeletons", async () => {
      const tips = await db.query(
        "select to_jsonb(tip_row) as value from public.daily_tips tip_row",
      );
      const plans = await db.query(
        "select to_jsonb(plan) as value from public.content_plans plan",
      );
      expect(
        tips.rows.map(({ value }) => DailyTipSchema.parse(value)),
      ).toHaveLength(30);
      expect(
        plans.rows.map(({ value }) => MonthSkeletonSchema.parse(value)).length,
      ).toBeGreaterThan(0);
    });
  },
);
