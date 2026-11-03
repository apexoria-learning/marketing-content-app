import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findAppUser: vi.fn(),
  insertAppUser: vi.fn(),
  updateAppUser: vi.fn(),
  insertMissingMembers: vi.fn(),
  listPromptInstructions: vi.fn(),
  insertPromptInstruction: vi.fn(),
  updateSettingsOverrides: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({
  env: {
    ADMIN_EMAILS: "owner@example.test",
    ALLOWED_EMAILS: "owner@example.test, legacy@example.test, two@example.test",
  },
}));
vi.mock("../../src/server/db/admin", () => db);

import type { AdminActor } from "../../src/server/auth";
import {
  grantAccess,
  importEnvironmentAllowlist,
  saveInstructions,
  updateAccess,
  updateSettings,
} from "../../src/server/services/admin";
import { ActionFailure } from "../../src/server/services/service-error";

const admin = { email: "admin@example.test", isOwner: false } as AdminActor;

beforeEach(() => {
  vi.clearAllMocks();
  db.findAppUser.mockResolvedValue(null);
  db.updateAppUser.mockResolvedValue(null);
  db.listPromptInstructions.mockResolvedValue([]);
});

async function refusal(promise: Promise<unknown>) {
  const error = await promise.catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(ActionFailure);
  return (error as ActionFailure).userMessage;
}

describe("access management guards", () => {
  it("never lets the panel change an environment owner", async () => {
    expect(
      await refusal(
        updateAccess(admin, { email: "owner@example.test", is_active: false }),
      ),
    ).toBe(
      "Owner access is managed in the server environment. Nothing was changed.",
    );
    expect(db.updateAppUser).not.toHaveBeenCalled();
  });

  it("prevents an admin from revoking or demoting themselves", async () => {
    expect(
      await refusal(
        updateAccess(admin, { email: "admin@example.test", role: "member" }),
      ),
    ).toContain("You can't change your own access.");
    expect(db.updateAppUser).not.toHaveBeenCalled();
  });

  it("grants new people and reactivates existing rows with attribution", async () => {
    expect(
      await grantAccess(admin, {
        email: "new@example.test",
        role: "member",
        can_generate: false,
      }),
    ).toEqual({ email: "new@example.test", status: "granted" });
    expect(db.insertAppUser).toHaveBeenCalledWith(
      {
        email: "new@example.test",
        role: "member",
        is_active: true,
        can_generate: false,
      },
      "admin@example.test",
    );
    db.findAppUser.mockResolvedValue({ email: "old@example.test" });
    expect(
      await grantAccess(admin, {
        email: "old@example.test",
        role: "admin",
        can_generate: true,
      }),
    ).toEqual({ email: "old@example.test", status: "updated" });
    expect(db.updateAppUser).toHaveBeenCalledWith(
      "old@example.test",
      { role: "admin", is_active: true, can_generate: true },
      "admin@example.test",
    );
  });

  it("records a revoke for a legacy env entry so it overrides ALLOWED_EMAILS", async () => {
    await updateAccess(admin, {
      email: "legacy@example.test",
      is_active: false,
    });
    expect(db.insertAppUser).toHaveBeenCalledWith(
      {
        email: "legacy@example.test",
        role: "member",
        is_active: false,
        can_generate: true,
      },
      "admin@example.test",
    );
  });

  it("refuses to update someone who was never given access", async () => {
    expect(
      await refusal(
        updateAccess(admin, { email: "stranger@example.test", role: "admin" }),
      ),
    ).toContain("Grant access first.");
    expect(db.insertAppUser).not.toHaveBeenCalled();
  });

  it("imports ALLOWED_EMAILS without owners", async () => {
    db.insertMissingMembers.mockResolvedValue(2);
    expect(await importEnvironmentAllowlist(admin)).toEqual({ imported: 2 });
    expect(db.insertMissingMembers).toHaveBeenCalledWith(
      ["legacy@example.test", "two@example.test"],
      "admin@example.test",
    );
  });

  it("refuses to run without an admin token", async () => {
    await expect(
      updateSettings({} as AdminActor, { regen_daily_limit: 5 }),
    ).rejects.toThrow("Admin actor is required.");
    expect(db.updateSettingsOverrides).not.toHaveBeenCalled();
  });
});

describe("editorial instruction versions", () => {
  it("adds a version only when the text changes", async () => {
    db.listPromptInstructions.mockResolvedValue([
      {
        id: 7,
        scope: "content",
        instructions: "Prefer Indian examples.",
        created_at: "2026-11-01T00:00:00Z",
        created_by: "admin@example.test",
      },
    ]);
    expect(
      await saveInstructions(admin, {
        scope: "content",
        instructions: "Prefer Indian examples.",
      }),
    ).toEqual({ version: 7, changed: false });
    expect(db.insertPromptInstruction).not.toHaveBeenCalled();
    db.insertPromptInstruction.mockResolvedValue({ id: 8 });
    expect(
      await saveInstructions(admin, { scope: "content", instructions: "" }),
    ).toEqual({ version: 8, changed: true });
    expect(db.insertPromptInstruction).toHaveBeenCalledWith(
      "content",
      "",
      "admin@example.test",
    );
  });
});
