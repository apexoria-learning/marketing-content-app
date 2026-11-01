import "server-only";
import { z } from "zod";
import { createUserDatabaseClient } from "../db/client";
import { env } from "../config/env";
import type { ActionResult } from "../../lib/schemas/action-result";
import { shiftDate, todayInIst } from "../../lib/utils/dates";

export async function consumeGenerationBudget(
  _email: string,
  planMonth = false,
): Promise<ActionResult<void>> {
  if (env.AI_GENERATION_ENABLED !== "true") {
    return {
      ok: false,
      code: "GENERATION_FAILED",
      message: "Generation is not enabled yet. Nothing was changed.",
    };
  }
  const client = await createUserDatabaseClient();
  const { data, error } = await client.rpc("consume_ai_budget", {
    p_user_limit: env.REGEN_DAILY_LIMIT,
    p_global_limit: env.GLOBAL_DAILY_AI_LIMIT,
    p_plan_month: planMonth,
  });
  if (error) throw error;
  if (!z.boolean().parse(data)) {
    const tomorrow = shiftDate(todayInIst(), 1);
    return {
      ok: false,
      code: "RATE_LIMITED",
      message:
        "Today's generation allowance has been used. Try again after midnight IST.",
      retry_after: new Date(`${tomorrow}T00:00:00+05:30`).toISOString(),
    };
  }
  return { ok: true, data: undefined };
}
