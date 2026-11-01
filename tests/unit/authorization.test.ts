import { AuthSessionMissingError, AuthApiError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  client: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({
  env: { ALLOWED_EMAILS: "member@example.test" },
}));
vi.mock("../../src/server/db/client", () => ({
  createUserDatabaseClient: mocks.client,
}));

import { getAuthorizedUser } from "../../src/server/auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("independent session authorization", () => {
  it("classifies a missing Supabase session as unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });
    expect(await getAuthorizedUser()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });

  it("classifies an invalid session as unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("Private provider detail", 401, "bad_jwt"),
    });
    expect(await getAuthorizedUser()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });

  it("fails closed on an unavailable auth service", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("Private provider detail", 503, undefined),
    });
    expect(await getAuthorizedUser()).toEqual({
      ok: false,
      code: "UNEXPECTED",
    });
    expect(console.error).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: "Private provider detail" }),
    );
  });

  it("denies a valid non-allowlisted account", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "id", email: "other@example.test" } },
      error: null,
    });
    expect(await getAuthorizedUser()).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns verified normalized session identity", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "id", email: " MEMBER@example.test " } },
      error: null,
    });
    expect(await getAuthorizedUser()).toEqual({
      ok: true,
      user: { id: "id", email: "member@example.test", role: "team_member" },
    });
  });
});
