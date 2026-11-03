import "server-only";
import { getPlatformCatalogue } from "../db/platforms";
import {
  toPlatformDisplay,
  type PlatformDisplay,
} from "../../lib/schemas/platforms";

/**
 * Display data for every catalogue platform, including retired ones that
 * still label existing content. Presentation only: an unreadable catalogue
 * degrades badges to their keys instead of taking down every screen, while
 * generation re-reads it and fails closed.
 */
export async function getPlatformDisplays(): Promise<PlatformDisplay[]> {
  try {
    return (await getPlatformCatalogue()).map(toPlatformDisplay);
  } catch (failure) {
    console.error("Platform catalogue unavailable; showing platform keys.", {
      code:
        typeof failure === "object" && failure !== null && "code" in failure
          ? String(failure.code)
          : undefined,
    });
    return [];
  }
}
