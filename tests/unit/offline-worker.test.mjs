import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({ preload: vi.fn(), options: [] }));
vi.mock("serwist", () => ({
  disableNavigationPreload: hooks.preload,
  Serwist: class {
    constructor(options) {
      hooks.options.push(options);
    }
    addEventListeners() {}
    async matchPrecache() {
      return new Response("Offline shell", {
        headers: { "Content-Type": "text/html" },
      });
    }
  },
}));
let listeners;
let storage;
const origin = "https://app.example.test";
const cacheName = "apexoria-private-v1";
const sessionUrl = `${origin}/__offline-session`;
function key(request) {
  return typeof request === "string" ? request : request.url;
}
beforeEach(async () => {
  vi.resetModules();
  listeners = new Map();
  storage = new Map();
  vi.stubGlobal("self", {
    location: { origin },
    __SW_MANIFEST: [],
    addEventListener: (name, handler) => listeners.set(name, handler),
  });
  vi.stubGlobal("caches", {
    delete: async (name) => storage.delete(name),
    open: async (name) => {
      if (!storage.has(name)) storage.set(name, new Map());
      const cache = storage.get(name);
      return {
        match: async (request) => cache.get(key(request))?.clone(),
        put: async (request, response) =>
          cache.set(key(request), response.clone()),
        keys: async () =>
          Array.from(cache.keys()).map((url) => new Request(url)),
        delete: async (request) => cache.delete(key(request)),
      };
    },
  });
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await import("../../src/app/sw.ts");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function verified(owner = "member", until = Date.now() + 60_000) {
  return new Response("Private content", {
    headers: {
      "x-offline-session": owner,
      "x-offline-until": String(until),
      "Content-Type": "text/html",
    },
  });
}
async function navigate(path = "/") {
  const request = new Request(`${origin}${path}`);
  Object.defineProperty(request, "mode", { value: "navigate" });
  let response;
  listeners.get("fetch")({
    request,
    respondWith: (value) => {
      response = value;
    },
  });
  return response ? await response : undefined;
}
async function message(data) {
  let work;
  const reply = vi.fn();
  listeners.get("message")({
    data,
    ports: [{ postMessage: reply }],
    waitUntil: (value) => {
      work = value;
    },
  });
  await work;
  return reply;
}
describe("authorization-bound private offline reads", () => {
  it("does not intercept OAuth callbacks or cache writes", async () => {
    expect(await navigate("/auth/callback?code=single-use")).toBeUndefined();
    let handled = false;
    const request = new Request(`${origin}/`, { method: "POST" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    listeners.get("fetch")({
      request,
      respondWith: () => {
        handled = true;
      },
    });
    expect(handled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(hooks.preload).toHaveBeenCalled();
    expect(hooks.options.at(-1)).toMatchObject({
      skipWaiting: false,
      runtimeCaching: [],
    });
  });
  it("serves cached private reads only after server-verified navigation", async () => {
    fetch.mockResolvedValueOnce(verified());
    await navigate("/");
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await (await navigate("/")).text()).toBe("Private content");
  });
  it("uses the public offline shell for an uncached route", async () => {
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await (await navigate("/calendar")).text()).toBe("Offline shell");
  });
  it("expires offline reads at the last verified session deadline", async () => {
    fetch.mockResolvedValueOnce(verified());
    await navigate("/");
    storage.get(cacheName).set(sessionUrl, verified("member", Date.now() - 1));
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await (await navigate("/")).text()).toBe("Offline shell");
    expect(storage.has(cacheName)).toBe(false);
  });
  it("purges old-account reads when another account is verified", async () => {
    fetch.mockResolvedValueOnce(verified("first"));
    await navigate("/calendar");
    fetch.mockResolvedValueOnce(verified("second"));
    await navigate("/create");
    expect(storage.get(cacheName).has(`${origin}/calendar`)).toBe(false);
    expect(storage.get(cacheName).has(`${origin}/create`)).toBe(true);
  });
  it("clears private data on an online authorization denial", async () => {
    fetch.mockResolvedValueOnce(verified());
    await navigate("/");
    fetch.mockResolvedValueOnce(new Response("Sign in", { status: 200 }));
    await navigate("/sign-in");
    expect(storage.has(cacheName)).toBe(false);
  });
  it("acknowledges cache purge before the sign-out action can proceed", async () => {
    fetch.mockResolvedValueOnce(verified());
    await navigate("/");
    const reply = await message({ type: "CLEAR_PRIVATE_CACHE" });
    expect(reply).toHaveBeenCalledWith({ ok: true });
    expect(storage.has(cacheName)).toBe(false);
  });
  it("refuses background downloads outside private same-origin routes", async () => {
    await message({ type: "CACHE_PAGE", url: "https://evil.test/" });
    await message({
      type: "CACHE_PAGE",
      url: `${origin}/auth/callback?code=private`,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("downloads HTML for a client transition instead of caching partial RSC payloads", async () => {
    fetch.mockResolvedValueOnce(verified());
    await message({
      type: "CACHE_PAGE",
      url: `${origin}/calendar?month=2026-11`,
    });
    const request = fetch.mock.calls[0][0];
    expect(request.headers.get("Accept")).toBe("text/html");
    expect(request.headers.has("RSC")).toBe(false);
    expect(storage.get(cacheName).has(`${origin}/calendar?month=2026-11`)).toBe(
      true,
    );
  });
  it("invalidates stale read pages after a mutation", async () => {
    fetch.mockResolvedValueOnce(verified());
    await navigate("/calendar");
    fetch.mockResolvedValueOnce(verified());
    await message({ type: "CONTENT_CHANGED", url: `${origin}/` });
    expect(storage.get(cacheName).has(`${origin}/calendar`)).toBe(false);
    expect(storage.get(cacheName).has(`${origin}/`)).toBe(true);
  });
  it("does not allow an in-flight download to repopulate caches after sign-out", async () => {
    let resolve;
    fetch.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const download = message({ type: "CACHE_PAGE", url: `${origin}/` });
    await message({ type: "CLEAR_PRIVATE_CACHE" });
    resolve(verified());
    await download;
    expect(storage.has(cacheName)).toBe(false);
  });
});
