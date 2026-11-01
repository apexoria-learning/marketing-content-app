import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, disableNavigationPreload } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [],
});

// No route consumes preloadResponse, so preload made browsers send every
// navigation twice — fatal for the single-use /auth/callback code (API.md §3.1).
// The setting persists on the registration, so it must be cleared explicitly.
disableNavigationPreload();

serwist.addEventListeners();
