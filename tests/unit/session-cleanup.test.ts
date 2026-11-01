import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  set: vi.fn(),
  signOut: vi.fn(),
  create: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: mocks.getAll, set: mocks.set }),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
vi.mock("../../src/server/config/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
  },
}));
import { destroyUserSession } from "../../src/server/db/client";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.create.mockReturnValue({ auth: { signOut: mocks.signOut } });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.getAll.mockReturnValue([
    { name: "sb-project-auth-token.0", value: "private" },
    { name: "sb-project-auth-token.1", value: "private" },
    { name: "sb-project-auth-token-code-verifier", value: "private" },
    { name: "theme", value: "light" },
    { name: "sb-other-auth-token", value: "other-project" },
  ]);
});

describe("local session destruction", () => {
  it("expires token chunks and PKCE cookies without affecting other cookies", async () => {
    expect(await destroyUserSession()).toBe(true);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.set).toHaveBeenCalledTimes(3);
    for (const [name, value, options] of mocks.set.mock.calls) {
      expect(name).toMatch(/^sb-project-auth-token/);
      expect(value).toBe("");
      expect(options).toMatchObject({
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
  });

  it("clears local credentials even when remote revocation fails", async () => {
    mocks.signOut.mockResolvedValue({
      error: { code: "unavailable", status: 503, message: "private" },
    });
    expect(await destroyUserSession()).toBe(false);
    expect(mocks.set).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private",
    );
  });

  it("clears local credentials if the revocation request throws", async () => {
    mocks.signOut.mockRejectedValue(new Error("private"));
    expect(await destroyUserSession()).toBe(false);
    expect(mocks.set).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalled();
  });
});
