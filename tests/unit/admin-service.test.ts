import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findAppUser: vi.fn(),
  insertAppUser: vi.fn(),
  updateAppUser: vi.fn(),
  insertMissingMembers: vi.fn(),
  listPromptInstructions: vi.fn(),
  insertPromptInstruction: vi.fn(),
  updateSettingsOverrides: vi.fn(),
  listPlatforms: vi.fn(),
  savePlatform: vi.fn(),
  setPlatformSortOrder: vi.fn(),
  listPillars: vi.fn(),
  savePillar: vi.fn(),
  setPillarSortOrder: vi.fn(),
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
  movePillar,
  movePlatform,
  saveInstructions,
  savePillarEntry,
  savePlatformEntry,
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

describe("platform catalogue management", () => {
  const existing = [
    { key: "instagram", is_enabled: true, formats: ["post", "reel"] },
    { key: "linkedin", is_enabled: true, formats: ["post"] },
    { key: "whatsapp", is_enabled: true, formats: ["story"] },
  ];
  const input = {
    key: "threads",
    label: "Threads",
    is_enabled: true,
    colour_slot: 4,
    icon: "chat" as const,
    formats: ["post" as const],
    allows_hashtags: false,
    max_hashtags: 0,
    caption_max_chars: null,
    tone: "",
    guidance: "",
  };

  beforeEach(() => {
    db.listPlatforms.mockResolvedValue(existing);
  });

  it("creates a new platform with attribution", async () => {
    expect(
      await savePlatformEntry(admin, { mode: "create", platform: input }),
    ).toEqual({ key: "threads", status: "created" });
    expect(db.savePlatform).toHaveBeenCalledWith(
      input,
      true,
      "admin@example.test",
    );
  });

  it("refuses duplicate keys and edits to unknown platforms", async () => {
    expect(
      await refusal(
        savePlatformEntry(admin, {
          mode: "create",
          platform: { ...input, key: "instagram" },
        }),
      ),
    ).toContain("already exists");
    expect(
      await refusal(
        savePlatformEntry(admin, { mode: "update", platform: input }),
      ),
    ).toContain("no longer exists");
    expect(db.savePlatform).not.toHaveBeenCalled();
  });

  it("refuses a change that leaves months unplannable", async () => {
    db.listPlatforms.mockResolvedValue([
      { key: "instagram", is_enabled: true, formats: ["post"] },
      { key: "linkedin", is_enabled: true, formats: ["post"] },
    ]);
    expect(
      await refusal(
        savePlatformEntry(admin, {
          mode: "update",
          platform: { ...input, key: "linkedin", is_enabled: false },
        }),
      ),
    ).toContain("Keep at least two enabled platform formats");
    expect(db.savePlatform).not.toHaveBeenCalled();
  });

  it("swaps display order with the neighbour and renumbers", async () => {
    await movePlatform(admin, { key: "whatsapp", direction: "up" });
    expect(db.setPlatformSortOrder.mock.calls).toEqual([
      ["instagram", 1, "admin@example.test"],
      ["whatsapp", 2, "admin@example.test"],
      ["linkedin", 3, "admin@example.test"],
    ]);
  });

  it("does nothing when a platform is already at the edge", async () => {
    await movePlatform(admin, { key: "instagram", direction: "up" });
    expect(db.setPlatformSortOrder).not.toHaveBeenCalled();
  });
});

describe("pillar catalogue management", () => {
  const topic = (key: string, overrides = {}) => ({
    key,
    is_enabled: true,
    requires_news: false,
    ...overrides,
  });
  const input = {
    key: "python_tips",
    label: "Py tips",
    description: "Small Python lessons",
    guidance: "",
    requires_news: false,
    is_enabled: true,
  };

  beforeEach(() => {
    db.listPillars.mockResolvedValue([
      topic("salesforce_tips"),
      topic("salesforce_news", { requires_news: true }),
      topic("memes"),
      topic("career_guidance"),
    ]);
  });

  it("creates a new pillar with attribution", async () => {
    expect(
      await savePillarEntry(admin, { mode: "create", pillar: input }),
    ).toEqual({ key: "python_tips", status: "created" });
    expect(db.savePillar).toHaveBeenCalledWith(
      input,
      true,
      "admin@example.test",
    );
  });

  it("refuses duplicate keys and edits to unknown pillars", async () => {
    expect(
      await refusal(
        savePillarEntry(admin, {
          mode: "create",
          pillar: { ...input, key: "memes" },
        }),
      ),
    ).toContain("already exists");
    expect(
      await refusal(savePillarEntry(admin, { mode: "update", pillar: input })),
    ).toContain("no longer exists");
    expect(db.savePillar).not.toHaveBeenCalled();
  });

  it("refuses retiring a topic pillar or flagging it as news below three topic pillars", async () => {
    for (const change of [{ is_enabled: false }, { requires_news: true }])
      expect(
        await refusal(
          savePillarEntry(admin, {
            mode: "update",
            pillar: { ...input, key: "memes", ...change },
          }),
        ),
      ).toBe(
        "Keep at least 3 enabled pillars that do not need news. Months must stay plannable. Nothing was changed.",
      );
    expect(db.savePillar).not.toHaveBeenCalled();
  });

  it("refuses enabling a fifteenth pillar", async () => {
    db.listPillars.mockResolvedValue(
      Array.from({ length: 14 }, (_, index) => topic(`pillar_${index}`)),
    );
    expect(
      await refusal(savePillarEntry(admin, { mode: "create", pillar: input })),
    ).toContain("Enable at most 14 pillars.");
    expect(
      await savePillarEntry(admin, {
        mode: "create",
        pillar: { ...input, is_enabled: false },
      }),
    ).toEqual({ key: "python_tips", status: "created" });
  });

  it("swaps display order with the neighbour and renumbers", async () => {
    await movePillar(admin, { key: "memes", direction: "down" });
    expect(db.setPillarSortOrder.mock.calls).toEqual([
      ["salesforce_tips", 1, "admin@example.test"],
      ["salesforce_news", 2, "admin@example.test"],
      ["career_guidance", 3, "admin@example.test"],
      ["memes", 4, "admin@example.test"],
    ]);
  });

  it("does nothing at the edge and refuses unknown pillars", async () => {
    await movePillar(admin, { key: "career_guidance", direction: "down" });
    expect(db.setPillarSortOrder).not.toHaveBeenCalled();
    expect(
      await refusal(movePillar(admin, { key: "gone", direction: "up" })),
    ).toContain("This pillar no longer exists.");
  });
});
