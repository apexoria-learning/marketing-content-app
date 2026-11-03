import "server-only";
import type { RuntimeConfig } from "../config/runtime";
import { getPlatformCatalogue, planningPlatforms } from "../db/platforms";
import type { ContentFormat } from "../../lib/schemas/content";
import type { PlanningFilters } from "../../lib/utils/planning-rules";
import { hasPlannablePlatforms } from "../../lib/schemas/platforms";
import { ActionFailure } from "./service-error";

/**
 * What new plans may use: enabled catalogue platforms with their formats and
 * the enabled pillars. `anchor` is a real enabled slot for loading context
 * (brand, news, history), replacing the former hard-coded platform.
 */
export async function loadPlanningScope(
  config: Pick<RuntimeConfig, "enabledPillars">,
): Promise<{
  filters: PlanningFilters;
  anchor: { platform: string; format: ContentFormat };
}> {
  const catalogue = await getPlatformCatalogue();
  const platforms = planningPlatforms(catalogue);
  const first = platforms[0];
  const format = first?.formats[0];
  if (!first || !format || !hasPlannablePlatforms(catalogue))
    throw new ActionFailure(
      "VALIDATION",
      "No plannable platforms are enabled.",
      "Enable at least two platform formats in Admin → Platforms. Nothing was changed.",
    );
  return {
    filters: { platforms, pillars: config.enabledPillars },
    anchor: { platform: first.key, format },
  };
}
