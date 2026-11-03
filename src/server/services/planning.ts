import "server-only";
import type { AiRequest } from "../ai/client";
import { generateMonthPlan } from "../ai/generators/month-plan";
import type { GenerationContext } from "../ai/schemas";
import type { PlannedSlot } from "../../lib/schemas/planning";
import {
  isMonthWithinHorizon,
  type PlanningFilters,
} from "../../lib/utils/planning-rules";
import { ActionFailure } from "./service-error";

export async function planMonth(
  input: {
    month: string;
    today: string;
    horizonMonths: number;
    filters: PlanningFilters;
  },
  dependencies: {
    exists: (month: string) => Promise<boolean>;
    loadContext: () => Promise<GenerationContext>;
    generate: (
      request: AiRequest,
      signal?: AbortSignal,
    ) => Promise<{ content: string }>;
    commitPlan: (plan: {
      month: string;
      items: PlannedSlot[];
      prompt_version: string;
      news_omitted: boolean;
    }) => Promise<{ plan_id: string; item_count: number }>;
  },
  signal?: AbortSignal,
) {
  if (!isMonthWithinHorizon(input.month, input.today, input.horizonMonths)) {
    throw new ActionFailure(
      "VALIDATION",
      "Month is outside the planning horizon.",
    );
  }
  if (await dependencies.exists(input.month)) {
    throw new ActionFailure("VALIDATION", "This month is already planned.");
  }
  const plan = await generateMonthPlan(
    {
      ...input,
      context: await dependencies.loadContext(),
    },
    dependencies.generate,
    signal,
  );
  // The adapter must commit the parent and every child in one database transaction.
  return dependencies.commitPlan({ month: input.month, ...plan });
}
