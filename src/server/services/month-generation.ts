import "server-only";
import { z } from "zod";
import { createUserDatabaseClient } from "../db/client";
import { createAiClient } from "../ai/client";
import { env } from "../config/env";
import { todayInIst } from "../../lib/utils/dates";
import { planMonth } from "./planning";
import { loadGenerationContext } from "./generation-context";
import { createRecordedAiClient } from "./recorded-ai";
import { MONTH_PLAN_REQUEST_TIMEOUT_MS } from "../ai/generators/month-plan";

export async function generateMonth(month: string) {
  const client = await createUserDatabaseClient();
  return planMonth(
    {
      month,
      today: todayInIst(),
      horizonMonths: env.PLANNING_HORIZON_MONTHS,
    },
    {
      async exists(value) {
        const { data, error } = await client
          .from("content_plans")
          .select("id")
          .eq("plan_month", `${value}-01`)
          .maybeSingle();
        if (error) throw error;
        return data !== null;
      },
      loadContext: () =>
        loadGenerationContext(
          client,
          {
            platform: "instagram",
            format: "post",
            pillar: "salesforce_tips",
            idea: "Plan the month",
          },
          todayInIst(),
        ),
      generate: createRecordedAiClient(
        client,
        createAiClient(env, { timeoutMs: MONTH_PLAN_REQUEST_TIMEOUT_MS }),
        {
          kind: "month_skeleton",
          target_month: `${month}-01`,
          model: env.AI_MODEL,
          prompt_version: "month-plan-v1",
        },
        null,
      ),
      async commitPlan(plan) {
        const { data, error } = await client.rpc("commit_month_plan", {
          p_month: `${plan.month}-01`,
          p_items: plan.items,
          p_model: env.AI_MODEL,
          p_prompt_version: plan.prompt_version,
        });
        if (error) throw error;
        const result = z
          .object({
            plan_id: z.uuid(),
            item_count: z.number().int().min(28).max(62),
          })
          .parse(data);
        if (plan.news_omitted)
          console.warn("Month planned with news explicitly omitted.");
        return { ...result, news_omitted: plan.news_omitted };
      },
    },
  );
}
