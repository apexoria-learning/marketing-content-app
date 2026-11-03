import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  destroy: vi.fn(),
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
  destroyUserSession: mocks.destroy,
}));
vi.mock("../../src/server/db/access", () => ({
  getAccessRecord: mocks.record,
}));
import { GET } from "../../src/app/auth/callback/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.client.mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchange },
  });
  mocks.exchange.mockResolvedValue({
    data: { user: { email: "member@example.test" } },
    error: null,
  });
  mocks.destroy.mockResolvedValue(true);
  mocks.record.mockResolvedValue(null);
});

async function callback(query: string) {
  return GET(
    new NextRequest(`https://app.example.test/auth/callback?${query}`),
  );
}

describe("OAuth callback", () => {
  it("redirects missing codes and provider rejection without attempting exchange", async () => {
    expect((await callback("error=cancelled")).headers.get("location")).toBe(
      "https://app.example.test/sign-in?error=oauth",
    );
    expect((await callback("")).headers.get("location")).toBe(
      "https://app.example.test/sign-in?error=exchange",
    );
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("exchanges the code and honors a safe next path", async () => {
    const response = await callback("code=single-use&next=%2Fcalendar");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://app.example.test/calendar",
    );
    expect(mocks.exchange).toHaveBeenCalledWith("single-use");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com"])(
    "rejects unsafe next: %s",
    async (next) => {
      const response = await callback(
        `code=single-use&next=${encodeURIComponent(next)}`,
      );
      expect(response.headers.get("location")).toBe(
        "https://app.example.test/",
      );
    },
  );

  it("rejects exchange errors without logging raw provider details", async () => {
    mocks.exchange.mockResolvedValue({
      data: { user: null },
      error: { code: "bad_code", status: 400, message: "private token" },
    });
    expect((await callback("code=single-use")).headers.get("location")).toBe(
      "https://app.example.test/sign-in?error=exchange",
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private token",
    );
  });

  it("destroys a non-allowlisted session before redirecting", async () => {
    mocks.exchange.mockResolvedValue({
      data: { user: { email: "other@example.test" } },
      error: null,
    });
    const response = await callback("code=single-use");
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(
      "https://app.example.test/no-access",
    );
  });

  it("denies a session without an email", async () => {
    mocks.exchange.mockResolvedValue({ data: { user: {} }, error: null });
    expect((await callback("code=single-use")).headers.get("location")).toBe(
      "https://app.example.test/no-access",
    );
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("admits an account granted in the admin panel", async () => {
    mocks.exchange.mockResolvedValue({
      data: { user: { email: "granted@example.test" } },
      error: null,
    });
    mocks.record.mockResolvedValue({
      role: "member",
      is_active: true,
      can_generate: true,
    });
    expect((await callback("code=single-use")).headers.get("location")).toBe(
      "https://app.example.test/",
    );
    expect(mocks.destroy).not.toHaveBeenCalled();
  });

  it("destroys the new session when the access list cannot be read", async () => {
    mocks.record.mockRejectedValue({ code: "08006" });
    expect((await callback("code=single-use")).headers.get("location")).toBe(
      "https://app.example.test/sign-in?error=session",
    );
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});
