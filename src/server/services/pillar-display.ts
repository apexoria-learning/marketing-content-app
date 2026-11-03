import "server-only";
import { getPillarCatalogue } from "../db/pillars";
import { toPillarDisplay, type PillarDisplay } from "../../lib/schemas/pillars";

/**
 * Display data for every catalogue pillar, including retired ones that still
 * label existing content. Presentation only: an unreadable catalogue degrades
 * chips to their keys instead of taking down every screen, while planning and
 * generation re-read it and fail closed.
 */
export async function getPillarDisplays(): Promise<PillarDisplay[]> {
  try {
    return (await getPillarCatalogue()).map(toPillarDisplay);
  } catch (failure) {
    console.error("Pillar catalogue unavailable; showing pillar keys.", {
      code:
        typeof failure === "object" && failure !== null && "code" in failure
          ? String(failure.code)
          : undefined,
    });
    return [];
  }
}
