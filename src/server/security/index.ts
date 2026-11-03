import "server-only";
import { z } from "zod";
import { createUserDatabaseClient } from "../db/client";
import { getRuntimeConfig } from "../db/settings";
import { env } from "../config/env";
import { lookupAccess } from "../auth/access";
import type { ActionResult } from "../../lib/schemas/action-result";
import { shiftDate, todayInIst } from "../../lib/utils/dates";

export async function consumeGenerationBudget(
  email: string,
  planMonth = false,
): Promise<ActionResult<void>> {
  const config = await getRuntimeConfig();
  if (!config.aiGenerationEnabled) {
    return {
      ok: false,
      code: "GENERATION_FAILED",
      message: "Generation is not enabled yet. Nothing was changed.",
    };
  }
  const client = await createUserDatabaseClient();
  // Re-read per-user AI access immediately before spending (API.md §7.2).
  const access = await lookupAccess(client, email, {
    ownerEmails: env.ADMIN_EMAILS,
    allowedEmails: env.ALLOWED_EMAILS,
  });
  if (access === null) throw new Error("Access list unavailable.");
  if (!access.allowed || !access.canGenerate) {
    return {
      ok: false,
      code: "GENERATION_FAILED",
      message:
        "AI generation isn't enabled for your account. Nothing was changed.",
    };
  }
  const { data, error } = await client.rpc("consume_ai_budget", {
    p_user_limit: config.regenDailyLimit,
    p_global_limit: config.globalDailyAiLimit,
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
