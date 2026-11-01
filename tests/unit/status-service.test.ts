import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  item: vi.fn(),
  persist: vi.fn(),
  month: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/db/queries", () => ({
  getItem: mocks.item,
  getMonthItems: mocks.month,
}));
vi.mock("../../src/server/db/content", () => ({
  changeContentStatus: mocks.persist,
  appendActivityNote: vi.fn(),
  updateBrandProfile: vi.fn(),
}));
import { changeContentStatus } from "../../src/server/services";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.item.mockResolvedValue({
    id: "id",
    status: "ready",
    body: {},
    design_brief: {},
    hydrated_at: "date",
    scheduled_date: "2026-11-01",
    posted_at: null,
  });
  mocks.persist.mockResolvedValue({ item: { status: "posted" } });
  mocks.month.mockResolvedValue([]);
});
describe("status service before the row-locked RPC", () => {
  it("permits a hydrated ready item to be posted", async () => {
    await changeContentStatus({ itemId: "id", status: "posted" });
    expect(mocks.persist).toHaveBeenCalledOnce();
  });
  it("rejects idea → posted without invoking the database mutation", async () => {
    mocks.item.mockResolvedValue({ status: "idea" });
    await expect(
      changeContentStatus({ itemId: "id", status: "posted" }),
    ).rejects.toMatchObject({ code: "23514" });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it("rejects a skipped unhydrated idea returning to ready", async () => {
    mocks.item.mockResolvedValue({ status: "skipped", body: null });
    await expect(
      changeContentStatus({ itemId: "id", status: "ready" }),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("does not change timestamp or append duplicate events for an already-applied status", async () => {
    await changeContentStatus({ itemId: "id", status: "ready" });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it("rejects a missing item explicitly", async () => {
    mocks.item.mockResolvedValue(null);
    await expect(
      changeContentStatus({ itemId: "id", status: "posted" }),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
