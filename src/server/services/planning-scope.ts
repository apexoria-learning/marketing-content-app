import "server-only";
import { getPillarCatalogue, planningPillars } from "../db/pillars";
import { getPlatformCatalogue, planningPlatforms } from "../db/platforms";
import type { ContentFormat } from "../../lib/schemas/content";
import type { PlanningFilters } from "../../lib/utils/planning-rules";
import { pillarPlannabilityError } from "../../lib/schemas/pillars";
import { hasPlannablePlatforms } from "../../lib/schemas/platforms";
import { ActionFailure } from "./service-error";

/**
 * What new plans may use: enabled catalogue platforms with their formats and
 * enabled catalogue pillars. `anchor` is a real enabled slot for loading
 * context (brand, news, history), replacing the former hard-coded values.
 */
export async function loadPlanningScope(): Promise<{
  filters: PlanningFilters;
  anchor: { platform: string; format: ContentFormat; pillar: string };
}> {
  const [platformCatalogue, pillarCatalogue] = await Promise.all([
    getPlatformCatalogue(),
    getPillarCatalogue(),
  ]);
  const platforms = planningPlatforms(platformCatalogue);
  const first = platforms[0];
  const format = first?.formats[0];
  if (!first || !format || !hasPlannablePlatforms(platformCatalogue))
    throw new ActionFailure(
      "VALIDATION",
      "No plannable platforms are enabled.",
      "Enable at least two platform formats in Admin → Platforms. Nothing was changed.",
    );
  const pillars = planningPillars(pillarCatalogue);
  const topic = pillars.find((pillar) => !pillar.requires_news);
  if (!topic || pillarPlannabilityError(pillarCatalogue))
    throw new ActionFailure(
      "VALIDATION",
      "Pillar catalogue is not plannable.",
      "Check the enabled pillars in Admin → Pillars. Nothing was changed.",
    );
  return {
    filters: { platforms, pillars },
    anchor: { platform: first.key, format, pillar: topic.key },
  };
}
