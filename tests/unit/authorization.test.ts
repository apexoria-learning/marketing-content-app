import { AuthSessionMissingError, AuthApiError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  client: vi.fn(),
  record: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({
  env: {
    ADMIN_EMAILS: "owner@example.test",
    ALLOWED_EMAILS: "member@example.test",
  },
}));
vi.mock("../../src/server/db/client", () => ({
  createUserDatabaseClient: mocks.client,
}));
vi.mock("../../src/server/db/access", () => ({
  getAccessRecord: mocks.record,
}));

import { getAuthorizedUser, toAdminActor } from "../../src/server/auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.record.mockResolvedValue(null);
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
      user: {
        id: "id",
        email: "member@example.test",
        role: "member",
        canGenerate: true,
        isOwner: false,
      },
    });
    expect(mocks.record).toHaveBeenCalledWith(
      expect.anything(),
      "member@example.test",
    );
  });

  it("grants database-managed access with its role and AI permission", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "id", email: "new@example.test" } },
      error: null,
    });
    mocks.record.mockResolvedValue({
      role: "admin",
      is_active: true,
      can_generate: false,
    });
    const result = await getAuthorizedUser();
    expect(result).toMatchObject({
      ok: true,
      user: { role: "admin", canGenerate: false, isOwner: false },
    });
    expect(result.ok && toAdminActor(result.user)).toMatchObject({
      email: "new@example.test",
    });
  });

  it("denies a revoked row even when the email is in ALLOWED_EMAILS", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "id", email: "member@example.test" } },
      error: null,
    });
    mocks.record.mockResolvedValue({
      role: "member",
      is_active: false,
      can_generate: true,
    });
    expect(await getAuthorizedUser()).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("admits ADMIN_EMAILS owners without depending on the database", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "id", email: "owner@example.test" } },
      error: null,
    });
    mocks.record.mockRejectedValue(new Error("database down"));
    expect(await getAuthorizedUser()).toMatchObject({
      ok: true,
      user: { role: "admin", isOwner: true, canGenerate: true },
    });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("fails closed when the access list cannot be read", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "id", email: "member@example.test" } },
      error: null,
    });
    mocks.record.mockRejectedValue({ code: "42P01", message: "private SQL" });
    expect(await getAuthorizedUser()).toEqual({
      ok: false,
      code: "UNEXPECTED",
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private SQL",
    );
  });

  it("never issues an admin token to a member", () => {
    expect(
      toAdminActor({
        id: "id",
        email: "member@example.test",
        role: "member",
        canGenerate: true,
        isOwner: false,
      }),
    ).toBeNull();
  });
});
