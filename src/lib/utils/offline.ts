export const PRIVATE_CACHE = "apexoria-private-v1";
export const OFFLINE_SESSION = "/__offline-session";
export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60_000;

export function isPrivatePage(path: string) {
  return (
    path === "/" ||
    ["/calendar", "/create", "/archive"].includes(path) ||
    /^\/item\/[0-9a-f-]+$/i.test(path)
  );
}

export async function clearPrivateCache() {
  const worker =
    "serviceWorker" in navigator ? navigator.serviceWorker.controller : null;
  if (!worker) {
    if ("caches" in window) await caches.delete(PRIVATE_CACHE);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const channel = new window.MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(new Error("Offline cleanup acknowledgement timed out."));
    }, 5000);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      clearTimeout(timeout);
      channel.port1.close();
      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "ok" in event.data &&
        event.data.ok === true
      )
        resolve();
      else reject(new Error("Offline cache cleanup failed."));
    };
    worker.postMessage({ type: "CLEAR_PRIVATE_CACHE" }, [channel.port2]);
  });
}

export function refreshOfflinePage(invalidate = false) {
  if ("serviceWorker" in navigator && navigator.onLine)
    navigator.serviceWorker.controller?.postMessage({
      type: invalidate ? "CONTENT_CHANGED" : "CACHE_PAGE",
      url: location.href,
    });
}

export async function clearDeniedOfflineSession(code: ActionCode) {
  if (code !== "UNAUTHENTICATED" && code !== "FORBIDDEN") return false;
  await clearPrivateCache();
  location.assign(code === "FORBIDDEN" ? "/no-access" : "/sign-in");
  return true;
}
import type { ActionCode } from "../schemas/action-result";
