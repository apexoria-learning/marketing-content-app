import { PillarSchema, type Pillar } from "../../lib/schemas/content";
import type { AppSettingsRow } from "../../lib/schemas/admin";
import type { Env } from "./env-schema";

export type RuntimeConfig = {
  aiGenerationEnabled: boolean;
  regenDailyLimit: number;
  globalDailyAiLimit: number;
  planDayOfMonth: number;
  planningHorizonMonths: number;
  aiModel: string;
  aiBaseUrl: string;
  newsFeedUrls: string[];
  enabledPillars: Pillar[];
};

export type RuntimeEnv = Pick<
  Env,
  | "AI_GENERATION_ENABLED"
  | "REGEN_DAILY_LIMIT"
  | "GLOBAL_DAILY_AI_LIMIT"
  | "PLAN_DAY_OF_MONTH"
  | "PLANNING_HORIZON_MONTHS"
  | "AI_MODEL"
  | "PORTKEY_BASE_URL"
  | "NEWS_FEED_URLS"
>;

export function runtimeDefaults(env: RuntimeEnv): RuntimeConfig {
  return {
    aiGenerationEnabled: env.AI_GENERATION_ENABLED === "true",
    regenDailyLimit: env.REGEN_DAILY_LIMIT,
    globalDailyAiLimit: env.GLOBAL_DAILY_AI_LIMIT,
    planDayOfMonth: env.PLAN_DAY_OF_MONTH,
    planningHorizonMonths: env.PLANNING_HORIZON_MONTHS,
    aiModel: env.AI_MODEL,
    aiBaseUrl: env.PORTKEY_BASE_URL,
    newsFeedUrls: env.NEWS_FEED_URLS.split(",")
      .map((url) => url.trim())
      .filter(Boolean),
    enabledPillars: [...PillarSchema.options],
  };
}

/**
 * Admin overrides (DATABASE.md §5.10) win over environment defaults; a NULL
 * override means "use the environment value". Lists keep canonical order so
 * prompts and validation are deterministic.
 */
export function resolveRuntimeConfig(
  env: RuntimeEnv,
  overrides: AppSettingsRow | null,
): RuntimeConfig {
  const defaults = runtimeDefaults(env);
  if (!overrides) return defaults;
  const pillars = overrides.enabled_pillars;
  return {
    aiGenerationEnabled:
      overrides.ai_generation_enabled ?? defaults.aiGenerationEnabled,
    regenDailyLimit: overrides.regen_daily_limit ?? defaults.regenDailyLimit,
    globalDailyAiLimit:
      overrides.global_daily_ai_limit ?? defaults.globalDailyAiLimit,
    planDayOfMonth: overrides.plan_day_of_month ?? defaults.planDayOfMonth,
    planningHorizonMonths:
      overrides.planning_horizon_months ?? defaults.planningHorizonMonths,
    aiModel: overrides.ai_model ?? defaults.aiModel,
    aiBaseUrl: overrides.ai_base_url ?? defaults.aiBaseUrl,
    newsFeedUrls: overrides.news_feed_urls ?? defaults.newsFeedUrls,

    enabledPillars: pillars
      ? PillarSchema.options.filter((value) => pillars.includes(value))
      : defaults.enabledPillars,
  };
}
