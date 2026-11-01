import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { fetchFeed } from "../../src/server/news/fetch-feed";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function respond(
  status: number,
  headers: Record<string, string>,
  body: Buffer[] = [],
) {
  mocks.request.mockImplementationOnce(
    (
      _url: URL,
      _options: unknown,
      callback: (response: EventEmitter) => void,
    ) => {
      const req = new EventEmitter();
      return Object.assign(req, {
        end() {
          const events = new EventEmitter();
          const response = Object.assign(events, {
            statusCode: status,
            headers,
            destroy(error?: Error) {
              if (error) events.emit("error", error);
            },
          });
          queueMicrotask(() => {
            callback(response);
            for (const chunk of body) response.emit("data", chunk);
            response.emit("end");
          });
        },
      });
    },
  );
}

describe("bounded feed transport", () => {
  it("accepts exactly 2 MB and sends conditional headers", async () => {
    respond(200, { etag: "new" }, [Buffer.alloc(2 * 1024 * 1024, "a")]);
    const result = await fetchFeed("https://example.com/rss", { etag: "old" });
    expect(result.xml?.length).toBe(2 * 1024 * 1024);
    expect(result.validators.etag).toBe("new");
    expect(mocks.request.mock.calls[0]?.[1].headers["If-None-Match"]).toBe(
      "old",
    );
    expect(mocks.request.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);
    expect(mocks.request.mock.calls[0]?.[1].family).toBe(4);
  });

  it("rejects a streamed body one byte above 2 MB and retries only once", async () => {
    for (let i = 0; i < 2; i++)
      respond(200, {}, [Buffer.alloc(2 * 1024 * 1024), Buffer.alloc(1)]);
    await expect(fetchFeed("https://example.com/rss")).rejects.toThrow(
      /body limit/,
    );
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });

  it("rejects an oversized Content-Length without accepting a body", async () => {
    for (let i = 0; i < 2; i++)
      respond(200, { "content-length": String(2 * 1024 * 1024 + 1) });
    await expect(fetchFeed("https://example.com/rss")).rejects.toThrow(
      /body limit/,
    );
  });

  it("returns no XML for a 304", async () => {
    respond(304, {});
    expect(await fetchFeed("https://example.com/rss", { etag: "old" })).toEqual(
      { xml: null, validators: { etag: "old" } },
    );
  });

  it("rejects redirects beyond three hops", async () => {
    for (let i = 0; i < 8; i++) respond(302, { location: "/next" });
    await expect(fetchFeed("https://example.com/rss")).rejects.toThrow(
      /redirect limit/,
    );
    expect(mocks.request).toHaveBeenCalledTimes(8);
  });

  it("validates redirect destinations and refuses private DNS before connecting", async () => {
    respond(302, { location: "https://internal.example.com/" });
    respond(302, { location: "https://internal.example.com/" });
    mocks.lookup
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }])
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await expect(fetchFeed("https://example.com/rss")).rejects.toThrow(
      /non-public/,
    );
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
});
