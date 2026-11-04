import { describe, expect, it } from "vitest";
import {
  AddNoteInputSchema,
  MarkPostedInputSchema,
  SkipItemInputSchema,
} from "../../src/lib/schemas/actions";

const itemId = "e3d1ba44-ef48-4cb3-a3fa-10d83b8e3c66";

describe("content action input schemas", () => {
  it("accepts valid status inputs and trims optional text", () => {
    expect(
      MarkPostedInputSchema.parse({
        item_id: itemId,
        posted: true,
        note: "  Shared with the cohort  ",
      }).note,
    ).toBe("Shared with the cohort");

    expect(
      SkipItemInputSchema.parse({
        item_id: itemId,
        skipped: true,
        reason: "  Not approved  ",
      }).reason,
    ).toBe("Not approved");
  });

  it("rejects malformed identifiers and extra fields", () => {
    expect(
      MarkPostedInputSchema.safeParse({
        item_id: "not-a-uuid",
        posted: true,
      }).success,
    ).toBe(false);
    expect(
      MarkPostedInputSchema.safeParse({
        item_id: itemId,
        posted: true,
        posted_by: "attacker@example.test",
      }).success,
    ).toBe(false);
  });

  it("enforces text limits and requires a non-empty standalone note", () => {
    expect(
      SkipItemInputSchema.safeParse({
        item_id: itemId,
        skipped: true,
        reason: "r".repeat(281),
      }).success,
    ).toBe(false);
    expect(
      AddNoteInputSchema.safeParse({ item_id: itemId, note: "   " }).success,
    ).toBe(false);
  });
});
