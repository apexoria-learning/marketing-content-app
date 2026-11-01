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
import {
  decodeArchiveCursor,
  getActivity,
  getArchive,
  getDisplayNames,
  withPosterNames,
} from "../../src/server/db/queries";

beforeEach(() => vi.clearAllMocks());

describe("display names for attribution", () => {
  it("looks up each distinct email once, case-insensitively, and keeps emails without names", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { "member@apexoria.test": "Asha Member" },
      error: null,
    });
    mocks.create.mockResolvedValue({ rpc });
    const items = await withPosterNames([
      { id: "1", posted_by: "Member@Apexoria.test" },
      { id: "2", posted_by: "member@apexoria.test" },
      { id: "3", posted_by: "unnamed@apexoria.test" },
      { id: "4", posted_by: null },
    ]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("user_display_names", {
      p_emails: ["member@apexoria.test", "unnamed@apexoria.test"],
    });
    expect(items.map((item) => item.posted_by_name)).toEqual([
      "Asha Member",
      "Asha Member",
      null,
      null,
    ]);
  });

  it("makes no database call when nothing is attributed", async () => {
    expect(await getDisplayNames([null, null])).toEqual(new Map());
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("batches large lookups within the function's 200-email cap", async () => {
    const rpc = vi
      .fn<(name: string, args: { p_emails: string[] }) => Promise<unknown>>()
      .mockResolvedValue({ data: {}, error: null });
    mocks.create.mockResolvedValue({ rpc });
    await getDisplayNames(
      Array.from({ length: 450 }, (_, index) => `${index}@example.test`),
    );
    expect(rpc.mock.calls.map(([, args]) => args.p_emails.length)).toEqual([
      200, 200, 50,
    ]);
  });

  it("falls back to emails, with a logged code, when the lookup is unavailable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST202", message: "function not found" },
      }),
    });
    const [item] = await withPosterNames([
      { id: "1", posted_by: "member@apexoria.test" },
    ]);
    expect(item?.posted_by_name).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "Display names unavailable; showing emails.",
      { code: "PGRST202" },
    );
  });
});
describe("archive query contracts", () => {
  it("reads complete activity history beyond the PostgREST cap with stable keysets", async () => {
    const itemId = "c862f630-7968-4b35-b048-9b7e9183fef1";
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: 1001 - index,
      content_item_id: itemId,
      action: "note_added",
      from_value: null,
      to_value: null,
      actor_email: "browser-test@example.test",
      note: `Note ${index}`,
      created_at: "2026-11-01T07:00:00.123456+00:00",
    }));
    const filters: string[] = [];
    const limits: number[] = [];
    let pageIndex = 0;
    mocks.create.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: { "browser-test@example.test": "Browser Tester" },
        error: null,
      }),
      from: () => {
        const page = rows.slice(pageIndex * 500, ++pageIndex * 500);
        const builder = {
          select: () => builder,
          in: () => builder,
          order: () => builder,
          limit: (limit: number) => {
            limits.push(limit);
            return builder;
          },
          or: (filter: string) => {
            filters.push(filter);
            return builder;
          },
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: page, error: null }).then(resolve),
        };
        return builder;
      },
    });
    const activity = await getActivity([itemId]);
    expect(activity).toHaveLength(1001);
    expect(activity[0]?.actor_name).toBe("Browser Tester");
    expect(new Set(activity.map((event) => event.id)).size).toBe(1001);
    expect(limits).toEqual([500, 500, 500]);
    expect(filters).toEqual([
      "created_at.lt.2026-11-01T07:00:00.123456+00:00,and(created_at.eq.2026-11-01T07:00:00.123456+00:00,id.lt.502)",
      "created_at.lt.2026-11-01T07:00:00.123456+00:00,and(created_at.eq.2026-11-01T07:00:00.123456+00:00,id.lt.2)",
    ]);
  });
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
    const cursor = {
      posted_at: "2026-11-01T07:00:00.123456+00:00",
      id: "c862f630-7968-4b35-b048-9b7e9183fef1",
    };
    await getArchive(
      parseReadParams({ scope: "all" }),
      Buffer.from(JSON.stringify(cursor)).toString("base64url"),
    );
    expect(calls.at(-1)).toContainEqual({
      name: "or",
      args: [
        `posted_at.lt.${cursor.posted_at},and(posted_at.eq.${cursor.posted_at},id.lt.${cursor.id})`,
      ],
    });
  });
});
