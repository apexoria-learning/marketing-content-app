import { describe, expect, it } from "vitest";
import { isEmailListed, parseEmailList } from "../../src/lib/auth/allowlist";
import { resolveAccess } from "../../src/lib/auth/access";
import { getSafeRedirectPath } from "../../src/lib/auth/redirect";
import {
  getAuthCookieOptions,
  getSessionCookieName,
  isSessionCookie,
} from "../../src/lib/auth/session-cookie";
import { SignInSearchSchema } from "../../src/lib/schemas/auth-search";

describe("email lists", () => {
  it("grants nothing when a list is empty (fail closed)", () => {
    expect(isEmailListed("team@example.com", "")).toBe(false);
    expect(isEmailListed("team@example.com", " , ")).toBe(false);
    expect(parseEmailList(" , ")).toEqual([]);
  });

  it("normalizes addresses and matches only listed users", () => {
    expect(
      isEmailListed(
        " TEAM@Example.com ",
        " owner@example.com, team@example.com ",
      ),
    ).toBe(true);
    expect(isEmailListed("other@example.com", "team@example.com")).toBe(false);
  });

  it("rejects users without a verified email", () => {
    expect(isEmailListed(null, "team@example.com")).toBe(false);
    expect(isEmailListed(undefined, "team@example.com")).toBe(false);
  });
});

describe("access resolution", () => {
  const lists = {
    ownerEmails: "owner@example.test",
    allowedEmails: "legacy@example.test",
  };
  const record = {
    role: "member" as const,
    is_active: true,
    can_generate: true,
  };

  it("always admits owners as admins, even with a revoked row", () => {
    expect(
      resolveAccess({
        ...lists,
        email: " Owner@Example.test ",
        record: { ...record, is_active: false },
      }),
    ).toEqual({
      allowed: true,
      role: "admin",
      canGenerate: true,
      source: "owner",
    });
  });

  it("uses an active database row's role and AI permission", () => {
    expect(
      resolveAccess({
        ...lists,
        email: "admin@example.test",
        record: { role: "admin", is_active: true, can_generate: false },
      }),
    ).toEqual({
      allowed: true,
      role: "admin",
      canGenerate: false,
      source: "database",
    });
  });

  it("lets a revoked row override the legacy environment list", () => {
    expect(
      resolveAccess({
        ...lists,
        email: "legacy@example.test",
        record: { ...record, is_active: false },
      }),
    ).toEqual({ allowed: false });
  });

  it("admits unimported ALLOWED_EMAILS entries as members", () => {
    expect(
      resolveAccess({ ...lists, email: "legacy@example.test", record: null }),
    ).toMatchObject({ allowed: true, role: "member", source: "environment" });
  });

  it("denies everyone else, including when every list is empty", () => {
    expect(
      resolveAccess({ ...lists, email: "stranger@example.test", record: null }),
    ).toEqual({ allowed: false });
    expect(
      resolveAccess({
        ownerEmails: "",
        allowedEmails: "",
        email: "anyone@example.test",
        record: null,
      }),
    ).toEqual({ allowed: false });
    expect(resolveAccess({ ...lists, email: null, record })).toEqual({
      allowed: false,
    });
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

describe("auth search and cookie boundaries", () => {
  it("ignores repeated or unknown sign-in parameters", () => {
    expect(
      SignInSearchSchema.parse({
        next: ["/calendar", "//evil.test"],
        error: "private-provider-error",
        notice: "unknown",
      }),
    ).toEqual({ next: undefined, error: undefined, notice: undefined });
  });

  it("recognizes only the current project's tokens and verifier chunks", () => {
    const name = getSessionCookieName("https://project.supabase.co");
    expect(name).toBe("sb-project-auth-token");
    for (const cookieName of [
      name,
      `${name}.0`,
      `${name}-code-verifier`,
      `${name}-code-verifier.0`,
    ]) {
      expect(isSessionCookie(cookieName, name)).toBe(true);
    }
    expect(isSessionCookie("sb-other-auth-token", name)).toBe(false);
    expect(isSessionCookie("theme", name)).toBe(false);
  });
});
