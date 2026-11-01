import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseReadParams } from "../../src/lib/schemas/read-params";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  item: vi.fn(),
  persist: vi.fn(),
  month: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/db/client", () => ({
  createUserDatabaseClient: mocks.create,
}));
import { decodeArchiveCursor, getArchive } from "../../src/server/db/queries";

beforeEach(() => vi.clearAllMocks());
describe("archive query contracts", () => {
  it.each([
    undefined,
    null,
    ["abc"],
    "",
    "a".repeat(513),
    "bad!",
    Buffer.from('{"posted_at":"bad","id":"x"}').toString("base64url"),
    Buffer.from(
      '{"posted_at":"2026-11-01T00:00:00Z","id":"c862f630-7968-4b35-b048-9b7e9183fef1","extra":true}',
    ).toString("base64url"),
  ])("discards malformed cursor %j", (value) =>
    expect(decodeArchiveCursor(value)).toBeUndefined(),
  );
  it("accepts only the strict timestamp/UUID tuple", () => {
    const value = {
      posted_at: "2026-11-01T00:00:00Z",
      id: "c862f630-7968-4b35-b048-9b7e9183fef1",
    };
    expect(
      decodeArchiveCursor(
        Buffer.from(JSON.stringify(value)).toString("base64url"),
      ),
    ).toEqual(value);
  });
  it("uses independent count queries and a 31-row lookahead with deterministic ordering", async () => {
    const calls: { name: string; args: unknown[] }[][] = [];
    mocks.create.mockResolvedValue({
      from: () => {
        const log: { name: string; args: unknown[] }[] = [];
        calls.push(log);
        const builder = {
          select: (...args: unknown[]) => {
            log.push({ name: "select", args });
            return builder;
          },
          eq: (...args: unknown[]) => {
            log.push({ name: "eq", args });
            return builder;
          },
          order: (...args: unknown[]) => {
            log.push({ name: "order", args });
            return builder;
          },
          limit: (...args: unknown[]) => {
            log.push({ name: "limit", args });
            return builder;
          },
          or: (...args: unknown[]) => {
            log.push({ name: "or", args });
            return builder;
          },
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
        };
        return builder;
      },
    });
    await getArchive(parseReadParams({ scope: "all" }), "bad");
    expect(calls).toHaveLength(15);
    const page = calls.at(-1);
    expect(page).toContainEqual({ name: "select", args: ["*", {}] });
    expect(calls[0]).toContainEqual({
      name: "select",
      args: ["*", { count: "exact", head: true }],
    });
    expect(page?.filter((call) => call.name === "select")).toHaveLength(1);
    expect(page).toContainEqual({ name: "limit", args: [31] });
    expect(page?.filter((call) => call.name === "order")).toEqual([
      { name: "order", args: ["posted_at", { ascending: false }] },
      { name: "order", args: ["id", { ascending: false }] },
    ]);
  });
});
