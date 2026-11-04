import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  change: vi.fn(),
  note: vi.fn(),
  revalidate: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock("server-only", () => ({}));
// Actions import modules that parse env at load; CI runs without app env.
vi.mock("../../src/server/config/env", () => ({ env: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("../../src/server/auth", () => ({
  getAuthorizedUser: mocks.authorize,
}));
vi.mock("../../src/server/db/client", () => ({
  destroyUserSession: mocks.destroy,
}));
vi.mock("../../src/server/services", () => ({
  changeContentStatus: mocks.change,
  appendActivityNote: mocks.note,
}));
import { markPosted, skipItem, addNote } from "../../src/server/actions";
import AppLayout from "../../src/app/(app)/layout";
import { signOut } from "../../src/server/auth/actions";

const itemId = "e3d1ba44-ef48-4cb3-a3fa-10d83b8e3c66";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({
    ok: true,
    user: { email: "member@example.test", id: "id", role: "team_member" },
  });
  mocks.destroy.mockResolvedValue(true);
  mocks.change.mockResolvedValue({
    item: { posted_at: null },
    month_progress: { posted: 1, planned: 2 },
  });
  mocks.note.mockResolvedValue(undefined);
});

describe("business action entrypoints", () => {
  it("every implemented action independently rejects missing sessions", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED" });
    const results = await Promise.all([
      markPosted({ item_id: itemId, posted: true }),
      skipItem({ item_id: itemId, skipped: true }),
      addNote({ item_id: itemId, note: "Reviewed" }),
    ]);
    for (const result of results) {
      expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    }
    expect(mocks.authorize).toHaveBeenCalledTimes(3);
    expect(mocks.change).not.toHaveBeenCalled();
    expect(mocks.note).not.toHaveBeenCalled();
  });

  it("passes session attribution to the note service", async () => {
    await addNote({ item_id: itemId, note: " Reviewed " });
    expect(mocks.note).toHaveBeenCalledWith({
      itemId,
      actorEmail: "member@example.test",
      note: "Reviewed",
    });
  });

  it("revalidates all affected content surfaces after status changes", async () => {
    await markPosted({ item_id: itemId, posted: true });
    for (const path of [
      "/",
      "/calendar",
      "/create",
      "/archive",
      `/item/${itemId}`,
    ]) {
      expect(mocks.revalidate).toHaveBeenCalledWith(path);
    }
  });
});

describe("layout independently authorizes content", () => {
  it.each([
    ["UNAUTHENTICATED", "/sign-in"],
    ["FORBIDDEN", "/no-access"],
    ["UNEXPECTED", "/sign-in?error=session"],
  ])("rejects %s even without middleware", async (code, path) => {
    mocks.authorize.mockResolvedValue({ ok: false, code });
    await expect(AppLayout({ children: "private content" })).rejects.toThrow(
      `REDIRECT:${path}`,
    );
  });

  describe("sign-out recovery", () => {
    it("lets denied users clear their session and confirms successful sign-out", async () => {
      await expect(signOut()).rejects.toThrow(
        "REDIRECT:/sign-in?notice=signed-out",
      );
      expect(mocks.destroy).toHaveBeenCalledOnce();
      expect(mocks.authorize).not.toHaveBeenCalled();
    });

    it("reports local-only sign-out if remote revocation failed", async () => {
      mocks.destroy.mockResolvedValue(false);
      await expect(signOut()).rejects.toThrow(
        "REDIRECT:/sign-in?notice=local-signout",
      );
    });
  });

  it("renders content only after verified authorization", async () => {
    expect(await AppLayout({ children: "private content" })).toBeDefined();
    expect(mocks.authorize).toHaveBeenCalledOnce();
  });
});
