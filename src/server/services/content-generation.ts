import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";
import { createUserDatabaseClient } from "../db/client";
import { createAiClient } from "../ai/client";
import { ContentItemSchema } from "../../lib/schemas/content";
import { todayInIst, shiftDate } from "../../lib/utils/dates";
import { PlannedSlotSchema } from "../../lib/schemas/planning";
import { getItem } from "../db/queries";
import {
  getActiveInstructions,
  getRuntimeConfig,
  loadRuntimeConfig,
} from "../db/settings";
import { hasHydratedContent } from "../../lib/utils/status";
import { consumeGenerationBudget } from "../security";
import type { ActionResult } from "../../lib/schemas/action-result";
import { createRecordedAiClient } from "./recorded-ai";
import { loadGenerationContext } from "./generation-context";
import { gatewayConfiguration } from "./gateway-configuration";
import { loadPlanningScope } from "./planning-scope";
import { generateItem } from "./item-generation";
import {
  DAY_PLAN_PROMPT_VERSION,
  generateDayPlan,
} from "../ai/generators/day-plan";
import { ActionFailure } from "./service-error";
import { isMonthWithinHorizon } from "../../lib/utils/planning-rules";
import {
  CONTENT_GENERATION_BUDGET_MS,
  CONTENT_REQUEST_TIMEOUT_MS,
  PROMPT_VERSION,
} from "../ai/prompts";

export async function getHydrationAllowance(
  itemId: string,
  email: string,
): Promise<ActionResult<void>> {
  const item = await getItem(itemId);
  if (item && item.status !== "posted" && hasHydratedContent(item))
    return { ok: true, data: undefined };
  return consumeGenerationBudget(email);
}

export async function generateContentItem(
  itemId: string,
  regenerate: boolean,
  steer?: string,
  signal?: AbortSignal,
) {
  const client = await createUserDatabaseClient();
  return generateContentItemWithClient(
    client,
    itemId,
    regenerate,
    steer,
    signal,
  );
}

export async function generateContentItemWithClient(
  client: SupabaseClient<Database>,
  itemId: string,
  regenerate: boolean,
  steer?: string,
  signal?: AbortSignal,
) {
  const budget = AbortSignal.timeout(CONTENT_GENERATION_BUDGET_MS);
  const config = await loadRuntimeConfig(client);
  return generateItem(
    { itemId, regenerate, steer },
    {
      async getItem(id) {
        const { data, error } = await client
          .from("content_items")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data ? ContentItemSchema.parse(data) : null;
      },
      context: async (item, guidance) =>
        loadGenerationContext(
          client,
          item,
          todayInIst(),
          guidance,
          (await getActiveInstructions(client, "content")) ?? undefined,
        ),
      generate: createRecordedAiClient(
        client,
        createAiClient(gatewayConfiguration(config), {
          timeoutMs: CONTENT_REQUEST_TIMEOUT_MS,
        }),
        {
          kind: regenerate ? "item_regeneration" : "item_hydration",
          content_item_id: itemId,
          model: config.aiModel,
          prompt_version: PROMPT_VERSION,
        },
        null,
      ),
      async save(value) {
        const { data, error } = await client.rpc("save_generated_item", {
          p_item_id: value.item.id,
          p_content: value.content,
          p_prompt_version: value.prompt_version,
          p_expected_updated_at: value.item.updated_at,
          p_regenerate: value.regenerate,
        });
        if (error) throw error;
        return ContentItemSchema.parse(data);
      },
      async recordFailure(item, message) {
        const { error } = await client
          .from("content_items")
          .update({ generation_error: message })
          .eq("id", item.id)
          .eq("status", "idea")
          .eq("updated_at", item.updated_at);
        if (error) throw error;
      },
    },
    signal ? AbortSignal.any([signal, budget]) : budget,
  );
}

export async function generateDay(date: string, count: number) {
  const today = todayInIst();
  const config = await getRuntimeConfig();
  if (
    date < today ||
    !isMonthWithinHorizon(date.slice(0, 7), today, config.planningHorizonMonths)
  )
    throw new ActionFailure(
      "VALIDATION",
      "Date is outside the planning horizon.",
    );
  const client = await createUserDatabaseClient();
  const { count: existing, error } = await client
    .from("content_items")
    .select("*", { count: "exact", head: true })
    .eq("scheduled_date", date);
  if (error) throw error;
  if (z.number().int().nonnegative().parse(existing) + count > 2)
    throw new ActionFailure("VALIDATION", "This day has no remaining slots.");
  const { filters, anchor } = await loadPlanningScope();
  const context = await loadGenerationContext(
    client,
    { ...anchor, idea: `Plan content for ${date}` },
    today,
    undefined,
    (await getActiveInstructions(client, "planning")) ?? undefined,
  );
  const generate = createRecordedAiClient(
    client,
    createAiClient(gatewayConfiguration(config)),
    {
      kind: "month_skeleton",
      target_month: `${date.slice(0, 7)}-01`,
      model: config.aiModel,
      prompt_version: DAY_PLAN_PROMPT_VERSION,
    },
    null,
  );
  const { data: adjacent, error: adjacentError } = await client
    .from("content_items")
    .select("pillar,format")
    .in("scheduled_date", [shiftDate(date, -1), shiftDate(date, 1)]);
  if (adjacentError) throw adjacentError;
  const adjacentSlots = z
    .array(PlannedSlotSchema.pick({ pillar: true, format: true }))
    .parse(adjacent);
  const plan = await generateDayPlan(
    {
      date,
      count,
      context,
      adjacentSlots,
      filters,
    },
    generate,
  );
  const { data, error: commitError } = await client.rpc("commit_day_items", {
    p_date: date,
    p_items: plan.items,
    p_prompt_version: plan.prompt_version,
  });
  if (commitError) throw commitError;
  return z.object({ item_ids: z.array(z.uuid()).min(1).max(2) }).parse(data);
}
