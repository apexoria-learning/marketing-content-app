import { describe, expect, it } from "vitest";
import { isEmailAllowed } from "../../src/lib/auth/allowlist";
import { getSafeRedirectPath } from "../../src/lib/auth/redirect";
import { getAuthCookieOptions } from "../../src/lib/auth/session-cookie";

describe("email allowlist", () => {
  it("allows all signed-in users when the optional allowlist is empty", () => {
    expect(isEmailAllowed("team@example.com", "")).toBe(true);
    expect(isEmailAllowed("team@example.com", " , ")).toBe(true);
  });

  it("normalizes addresses and matches only allowlisted users", () => {
    expect(
      isEmailAllowed(
        " TEAM@Example.com ",
        " owner@example.com, team@example.com ",
      ),
    ).toBe(true);
    expect(isEmailAllowed("other@example.com", "team@example.com")).toBe(false);
  });

  it("rejects users without a verified email", () => {
    expect(isEmailAllowed(null, "")).toBe(false);
    expect(isEmailAllowed(undefined, "team@example.com")).toBe(false);
  });
});

describe("post-login redirect", () => {
  it("accepts local path, query and fragment", () => {
    expect(getSafeRedirectPath("/calendar?month=2026-10#today")).toBe(
      "/calendar?month=2026-10#today",
    );
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    null,
  ])("falls back to the app root for unsafe destinations: %s", (value) => {
    expect(getSafeRedirectPath(value)).toBe("/");
  });
});

describe("authentication cookie options", () => {
  it("uses persistent, HTTP-only, same-site cookies and secures production cookies", () => {
    expect(getAuthCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  });

  it("keeps local HTTP development usable without weakening production", () => {
    expect(getAuthCookieOptions(false).secure).toBe(false);
  });
});
