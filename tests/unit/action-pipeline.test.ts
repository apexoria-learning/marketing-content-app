import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/auth", () => ({
  getAuthorizedUser: mocks.authorize,
}));
vi.mock("../../src/server/db/client", () => ({
  destroyUserSession: mocks.destroy,
}));

import {
  ActionFailure,
  runAuthorizedAction,
} from "../../src/server/actions/run-action";

const schema = z.object({ note: z.string().trim().min(1).max(280) }).strict();
const operation = vi.fn();
const revalidate = vi.fn();
const rateLimit = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.authorize.mockResolvedValue({
    ok: true,
    user: { id: "id", email: "member@example.test", role: "team_member" },
  });
  mocks.destroy.mockResolvedValue(true);
  operation.mockResolvedValue({ saved: true });
  rateLimit.mockResolvedValue({ ok: true, data: undefined });
});

function run(input: unknown = { note: " Reviewed " }) {
  return runAuthorizedAction(input, schema, operation, revalidate, rateLimit);
}

describe("six-step action pipeline", () => {
  it("short-circuits missing sessions before parsing or service calls", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED" });
    expect(await run(null)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  it("destroys a denied session without performing a mutation", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    expect(await run()).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(operation).not.toHaveBeenCalled();
  });

  it("rejects extra fields and bounds before consuming any quota", async () => {
    expect(
      await run({ note: "x".repeat(281), actor_email: "attacker" }),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fields: { note: expect.any(String) },
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  it("preserves the rate-limit reset and performs no service call", async () => {
    rateLimit.mockResolvedValue({
      ok: false,
      code: "RATE_LIMITED",
      message: "You've hit today's regeneration limit.",
      retry_after: "2026-11-02T18:30:00Z",
    });
    expect(await run()).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retry_after: "2026-11-02T18:30:00Z",
    });
    expect(operation).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("passes parsed input and session email, then revalidates", async () => {
    expect(await run()).toEqual({ ok: true, data: { saved: true } });
    expect(operation).toHaveBeenCalledWith(
      { note: "Reviewed" },
      "member@example.test",
    );
    expect(revalidate).toHaveBeenCalledWith({ note: "Reviewed" });
    expect(rateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      operation.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(operation.mock.invocationCallOrder[0]).toBeLessThan(
      revalidate.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it("does not consume quota for existing zero-cost actions", async () => {
    expect(
      await runAuthorizedAction(
        { note: "Reviewed" },
        schema,
        operation,
        revalidate,
      ),
    ).toEqual({ ok: true, data: { saved: true } });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it.each(["P0001", "23514", "23505"])(
    "maps database %s errors without leaking internals",
    async (code) => {
      operation.mockRejectedValue({
        code,
        message: "private SQL and table name",
      });
      expect(await run()).toEqual({
        ok: false,
        code: "VALIDATION",
        message: "This change is not allowed. Nothing was changed.",
      });
      expect(revalidate).not.toHaveBeenCalled();
    },
  );

  it("returns generation failure without leaking a provider error", async () => {
    operation.mockRejectedValue(
      new ActionFailure("GENERATION_FAILED", "private provider"),
    );
    expect(await run()).toEqual({
      ok: false,
      code: "GENERATION_FAILED",
      message: "Generation didn't complete. Nothing was changed.",
    });
  });

  it("catches unexpected session or service failures", async () => {
    mocks.authorize.mockRejectedValue(new Error("private credential"));
    expect(await run()).toMatchObject({ ok: false, code: "UNEXPECTED" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("reports saved data accurately if revalidation fails", async () => {
    revalidate.mockImplementationOnce(() => {
      throw new Error("private detail");
    });
    expect(await run()).toEqual({
      ok: false,
      code: "UNEXPECTED",
      message:
        "Your changes were saved, but the view could not refresh. Reload the page.",
      saved: true,
    });
  });
});
