import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionMissingError } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  create: vi.fn(),
  allowed: vi.fn(),
  expired: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/db/middleware", () => ({
  createMiddlewareDatabaseClient: mocks.create,
  getExpiredSessionCookies: mocks.expired,
}));
vi.mock("../../src/server/auth/middleware", () => ({
  isMiddlewareUserAllowed: mocks.allowed,
}));
import { middleware } from "../../src/middleware";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.create.mockReturnValue({
    auth: { getUser: mocks.getUser, signOut: mocks.signOut },
  });
  mocks.getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthSessionMissingError(),
  });
  mocks.allowed.mockReturnValue(true);
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.expired.mockReturnValue([
    {
      name: "sb-project-auth-token",
      value: "",
      options: { path: "/", maxAge: 0 },
    },
  ]);
});

describe("middleware session boundaries", () => {
  it("marks only verified allowlisted private GETs as eligible for offline reads", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "verified-id", email: "member@example.test" } },
      error: null,
    });
    const response = await middleware(
      new NextRequest("https://app.example.test/calendar"),
    );
    expect(response.headers.get("x-offline-session")).toBe("verified-id");
    expect(Number(response.headers.get("x-offline-until"))).toBeGreaterThan(
      Date.now(),
    );
    const action = await middleware(
      new NextRequest("https://app.example.test/calendar", {
        method: "POST",
        headers: { "Next-Action": "id" },
      }),
    );
    expect(action.headers.get("x-offline-session")).toBeNull();
    const publicPage = await middleware(
      new NextRequest("https://app.example.test/sign-in"),
    );
    expect(publicPage.headers.get("x-offline-session")).toBeNull();
  });
  it.each([
    "/",
    "/calendar",
    "/create",
    "/archive",
    "/settings",
    "/item/example",
  ])("redirects unauthenticated %s", async (path) => {
    const response = await middleware(
      new NextRequest(`https://app.example.test${path}`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in?next=");
    expect(response.headers.get("content-security-policy")).toContain(
      "'nonce-",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("leaves OAuth callback reachable before a session exists", async () => {
    const response = await middleware(
      new NextRequest("https://app.example.test/auth/callback?code=private"),
    );
    expect(response.status).toBe(200);
  });

  it("lets server actions enforce auth and return their own envelope", async () => {
    const response = await middleware(
      new NextRequest("https://app.example.test/", {
        method: "POST",
        headers: { "Next-Action": "action-id" },
      }),
    );
    expect(response.status).toBe(200);
  });

  it("destroys denied local credentials even on remote sign-out failure", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { email: "denied@example.test" } },
      error: null,
    });
    mocks.allowed.mockReturnValue(false);
    mocks.signOut.mockResolvedValue({
      error: { code: "unavailable", status: 503 },
    });
    const response = await middleware(
      new NextRequest("https://app.example.test/"),
    );
    expect(response.headers.get("location")).toBe(
      "https://app.example.test/no-access",
    );
    expect(response.cookies.get("sb-project-auth-token")?.maxAge).toBe(0);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("carries refreshed session cookies onto protected-route redirects", async () => {
    mocks.create.mockImplementation((_request, setCookies) => {
      setCookies(
        [
          {
            name: "sb-project-auth-token",
            value: "refreshed",
            options: { httpOnly: true, path: "/" },
          },
        ],
        { "Cache-Control": "private, no-store" },
      );
      return { auth: { getUser: mocks.getUser } };
    });
    const response = await middleware(
      new NextRequest("https://app.example.test/calendar"),
    );
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe(
      "refreshed",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
