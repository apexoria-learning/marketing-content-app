import { describe, expect, expectTypeOf, it } from "vitest";
import type { BusinessProfileRecord } from "../../src/lib/schemas/business-profile";
import {
  Constants,
  type Database,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from "../../src/server/db/database.types";

describe("generated database query contracts", () => {
  it("preserves nullable unhydrated content fields", () => {
    expectTypeOf<Tables<"content_items">["caption"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<Tables<"content_items">["status"]>().toEqualTypeOf<
      "idea" | "ready" | "posted" | "skipped"
    >();
  });

  it("reads the business profile without a parallel handwritten type", () => {
    expectTypeOf<Omit<BusinessProfileRecord, "links">>().toExtend<
      TablesUpdate<"brand_profile">
    >();
    expectTypeOf<Tables<"brand_profile">["industry"]>().toEqualTypeOf<string>();
  });

  it("types audit inserts and status RPC arguments", () => {
    const audit = {
      content_item_id: "00000000-0000-4000-8000-000000000001",
      action: "note_added",
      actor_email: "member@example.test",
      note: "Reviewed",
    } satisfies TablesInsert<"activity_log">;
    const args = {
      p_item_id: audit.content_item_id,
      p_status: "skipped",
    } satisfies Database["public"]["Functions"]["change_content_status"]["Args"];

    expect(audit.action).toBe("note_added");
    expect(args.p_status).toBe("skipped");
    expectTypeOf<
      Database["public"]["Functions"]["consume_rate_limit"]["Returns"]
    >().toEqualTypeOf<boolean>();
  });

  it("contains all eight domain enums", () => {
    expect(Object.keys(Constants.public.Enums)).toHaveLength(8);
    expect(Constants.public.Enums.platform).toEqual([
      "instagram",
      "linkedin",
      "whatsapp",
    ]);
    expect(Constants.public.Enums.content_format).toHaveLength(6);
    expect(Constants.public.Enums.content_pillar).toHaveLength(10);
  });
});
