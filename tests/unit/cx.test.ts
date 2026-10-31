import { describe, expect, it } from "vitest";
import { cx } from "../../src/lib/utils/cx";

describe("cx", () => {
  it("joins enabled class names and omits disabled values", () => {
    expect(cx("px-page", false, undefined, "text-primary", null)).toBe(
      "px-page text-primary",
    );
  });
});
