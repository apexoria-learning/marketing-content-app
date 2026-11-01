import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, disableNavigationPreload } from "serwist";
import {
  PRIVATE_CACHE,
  OFFLINE_SESSION,
  OFFLINE_MAX_AGE,
  isPrivatePage,
} from "../lib/utils/offline";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  runtimeCaching: [],
});

let generation = 0;
let cacheWork: Promise<unknown> = Promise.resolve();
function serializeCache<T>(operation: () => Promise<T>): Promise<T> {
  const work = cacheWork.then(operation);
  cacheWork = work.catch(() =>
    console.error("Private offline cache operation failed."),
  );
  return work;
}
const sessionUrl = new URL(OFFLINE_SESSION, self.location.origin).href;
async function purgePrivate() {
  generation += 1;
  await caches.delete(PRIVATE_CACHE);
}

async function rememberPage(
  request: Request,
  response: Response,
  startedGeneration: number,
) {
  const owner = response.headers.get("x-offline-session");
  const until = Number(response.headers.get("x-offline-until"));
  if (!response.ok || !owner || until <= Date.now()) {
    if (!owner && response.status < 500) await serializeCache(purgePrivate);
    return;
  }
  await serializeCache(async () => {
    if (generation !== startedGeneration) return;
    const cache = await caches.open(PRIVATE_CACHE);
    const session = await cache.match(sessionUrl);
    const oldOwner = session?.headers.get("x-offline-session");
    if (oldOwner && oldOwner !== owner) await purgePrivate();
    const current = await caches.open(PRIVATE_CACHE);
    await current.put(
      sessionUrl,
      new Response("", {
        headers: {
          "x-offline-session": owner,
          "x-offline-until": String(
            Math.min(until, Date.now() + OFFLINE_MAX_AGE),
          ),
        },
      }),
    );
    await current.put(request, response);
    const keys = (await current.keys()).filter((key) => key.url !== sessionUrl);
    for (const key of keys.slice(0, Math.max(0, keys.length - 30)))
      await current.delete(key);
  });
}

async function downloadPage(url: string, invalidate: boolean) {
  const target = new URL(url, self.location.origin);
  if (target.origin !== self.location.origin || !isPrivatePage(target.pathname))
    return;
  if (invalidate) {
    generation += 1;
    await serializeCache(purgePrivate);
  }
  const startedGeneration = generation;
  const request = new Request(target.href, {
    headers: { Accept: "text/html" },
    credentials: "same-origin",
    cache: "no-store",
  });
  const response = await fetch(request);
  await rememberPage(request, response, startedGeneration);
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHE") {
    generation += 1;
    event.waitUntil(
      serializeCache(purgePrivate).then(
        () => event.ports[0]?.postMessage({ ok: true }),
        () => event.ports[0]?.postMessage({ ok: false }),
      ),
    );
  } else if (
    (event.data?.type === "CACHE_PAGE" ||
      event.data?.type === "CONTENT_CHANGED") &&
    typeof event.data.url === "string"
  ) {
    event.waitUntil(
      downloadPage(event.data.url, event.data.type === "CONTENT_CHANGED").catch(
        () => console.warn("This page could not be refreshed for offline use."),
      ),
    );
  }
});
self.addEventListener("activate", (event) =>
  event.waitUntil(serializeCache(purgePrivate)),
);
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isAuthEntry =
    url.pathname === "/sign-in" || url.pathname === "/no-access";
  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== self.location.origin ||
    (!isPrivatePage(url.pathname) && !isAuthEntry)
  )
    return;
  event.respondWith(
    (async () => {
      const startedGeneration = generation;
      let network: Response | undefined;
      try {
        network = await fetch(request);
      } catch {
        console.info(
          "Navigation unavailable; checking the verified offline cache.",
        );
      }
      if (network && (network.ok || network.status < 500)) {
        await rememberPage(request, network.clone(), startedGeneration).catch(
          () => console.error("This page could not be stored for offline use."),
        );
        return network;
      }
      return serializeCache(async () => {
        const cache = await caches.open(PRIVATE_CACHE);
        const session = await cache.match(sessionUrl);
        if (
          isPrivatePage(url.pathname) &&
          Number(session?.headers.get("x-offline-until")) > Date.now()
        ) {
          const cached = await cache.match(request);
          if (
            cached &&
            cached.headers.get("x-offline-session") ===
              session?.headers.get("x-offline-session")
          )
            return cached;
        } else await purgePrivate();
        const fallback = await serwist.matchPrecache("/offline.html");
        return (
          fallback ??
          new Response("You're offline. Reconnect and retry.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      }).catch(() => {
        console.error("Offline storage could not be read.");
        return new Response(
          "Offline storage is unavailable. Reconnect and reload.",
          { status: 503, headers: { "Content-Type": "text/plain" } },
        );
      });
    })(),
  );
});

// No route consumes preloadResponse, so preload made browsers send every
// navigation twice — fatal for the single-use /auth/callback code (API.md §3.1).
// The setting persists on the registration, so it must be cleared explicitly.
disableNavigationPreload();

serwist.addEventListeners();
