import { describe, expect, it } from "vitest";
import {
  AppSettingsUpdateSchema,
  GrantAccessInputSchema,
  SaveInstructionsInputSchema,
  UpdateAccessInputSchema,
} from "../../src/lib/schemas/admin";
import {
  resolveRuntimeConfig,
  runtimeDefaults,
  type RuntimeEnv,
} from "../../src/server/config/runtime";
import { parseEnv } from "../../src/server/config/env-schema";

describe("admin input contracts", () => {
  it("normalizes access emails and rejects extra fields", () => {
    expect(
      GrantAccessInputSchema.parse({
        email: "  New.Person@Gmail.com ",
        role: "member",
        can_generate: true,
      }),
    ).toEqual({
      email: "new.person@gmail.com",
      role: "member",
      can_generate: true,
    });
    expect(
      GrantAccessInputSchema.safeParse({
        email: "not-an-email",
        role: "member",
        can_generate: true,
      }).success,
    ).toBe(false);
    expect(
      GrantAccessInputSchema.safeParse({
        email: "a@b.test",
        role: "owner",
        can_generate: true,
      }).success,
    ).toBe(false);
    expect(
      GrantAccessInputSchema.safeParse({
        email: "a@b.test",
        role: "member",
        can_generate: true,
        updated_by: "attacker@example.test",
      }).success,
    ).toBe(false);
  });

  it("requires an actual change when updating access", () => {
    expect(
      UpdateAccessInputSchema.safeParse({ email: "a@b.test" }).success,
    ).toBe(false);
    expect(
      UpdateAccessInputSchema.safeParse({ email: "a@b.test", is_active: false })
        .success,
    ).toBe(true);
  });

  it("keeps planning feasible: one platform and three non-news pillars", () => {
    expect(
      AppSettingsUpdateSchema.safeParse({ enabled_platforms: [] }).success,
    ).toBe(false);
    expect(
      AppSettingsUpdateSchema.safeParse({
        enabled_platforms: ["linkedin", "linkedin"],
      }).success,
    ).toBe(false);
    expect(
      AppSettingsUpdateSchema.safeParse({
        enabled_pillars: ["salesforce_news", "memes", "salesforce_tips"],
      }).success,
    ).toBe(false);
    expect(
      AppSettingsUpdateSchema.safeParse({
        enabled_pillars: ["memes", "salesforce_tips", "career_guidance"],
      }).success,
    ).toBe(true);
  });

  it("only accepts credential-free HTTPS v1 gateways and HTTPS feeds", () => {
    for (const url of [
      "http://gateway.example.test/v1",
      "https://user:pass@gateway.example.test/v1",
      "https://gateway.example.test/v2",
      "https://gateway.example.test/v1?key=1",
    ])
      expect(
        AppSettingsUpdateSchema.safeParse({ ai_base_url: url }).success,
      ).toBe(false);
    expect(
      AppSettingsUpdateSchema.safeParse({
        ai_base_url: "https://gateway.example.test/v1",
      }).success,
    ).toBe(true);
    expect(
      AppSettingsUpdateSchema.safeParse({
        news_feed_urls: ["http://feed.example.test/rss"],
      }).success,
    ).toBe(false);
  });

  it("bounds limits and lets null restore the environment default", () => {
    expect(
      AppSettingsUpdateSchema.safeParse({ regen_daily_limit: 0 }).success,
    ).toBe(false);
    expect(
      AppSettingsUpdateSchema.safeParse({ planning_horizon_months: 13 })
        .success,
    ).toBe(false);
    expect(
      AppSettingsUpdateSchema.parse({
        regen_daily_limit: null,
        ai_model: null,
      }),
    ).toEqual({ regen_daily_limit: null, ai_model: null });
    expect(AppSettingsUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("bounds editorial instructions and allows clearing them", () => {
    expect(
      SaveInstructionsInputSchema.safeParse({
        scope: "content",
        instructions: "x".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      SaveInstructionsInputSchema.parse({
        scope: "planning",
        instructions: "  ",
      }),
    ).toEqual({ scope: "planning", instructions: "" });
    expect(
      SaveInstructionsInputSchema.safeParse({
        scope: "system",
        instructions: "",
      }).success,
    ).toBe(false);
  });
});

describe("runtime configuration", () => {
  const env: RuntimeEnv = {
    AI_GENERATION_ENABLED: "false",
    REGEN_DAILY_LIMIT: 20,
    GLOBAL_DAILY_AI_LIMIT: 100,
    PLAN_DAY_OF_MONTH: 25,
    PLANNING_HORIZON_MONTHS: 2,
    AI_MODEL: "@env/model",
    PORTKEY_BASE_URL: "https://env.example.test/v1",
    NEWS_FEED_URLS:
      " https://a.example.test/feed , ,https://b.example.test/feed",
  };
  const noOverrides = {
    ai_generation_enabled: null,
    regen_daily_limit: null,
    global_daily_ai_limit: null,
    plan_day_of_month: null,
    planning_horizon_months: null,
    ai_model: null,
    ai_base_url: null,
    news_feed_urls: null,
    enabled_platforms: null,
    enabled_pillars: null,
    updated_at: "2026-11-01T00:00:00Z",
    updated_by: null,
  };

  it("uses environment values when nothing is overridden", () => {
    expect(resolveRuntimeConfig(env, noOverrides)).toEqual(
      runtimeDefaults(env),
    );
    expect(resolveRuntimeConfig(env, null)).toMatchObject({
      aiGenerationEnabled: false,
      aiModel: "@env/model",
      newsFeedUrls: [
        "https://a.example.test/feed",
        "https://b.example.test/feed",
      ],
      enabledPlatforms: ["instagram", "linkedin", "whatsapp"],
    });
    expect(runtimeDefaults(env).enabledPillars).toHaveLength(10);
  });

  it("applies admin overrides, including false and empty lists, in canonical order", () => {
    const config = resolveRuntimeConfig(
      { ...env, AI_GENERATION_ENABLED: "true" },
      {
        ...noOverrides,
        ai_generation_enabled: false,
        regen_daily_limit: 5,
        ai_model: "@admin/model",
        news_feed_urls: [],
        enabled_platforms: ["whatsapp", "instagram"],
        enabled_pillars: ["memes", "salesforce_tips", "career_guidance"],
      },
    );
    expect(config).toMatchObject({
      aiGenerationEnabled: false,
      regenDailyLimit: 5,
      globalDailyAiLimit: 100,
      aiModel: "@admin/model",
      aiBaseUrl: "https://env.example.test/v1",
      newsFeedUrls: [],
      enabledPlatforms: ["instagram", "whatsapp"],
      enabledPillars: ["salesforce_tips", "memes", "career_guidance"],
    });
  });

  it("parses the optional owner list from the environment", () => {
    const parsed = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      PORTKEY_API_KEY: "key",
      AI_MODEL: "model",
      CRON_SECRET: "x".repeat(32),
      NEXT_PUBLIC_APP_URL: "https://app.example.test",
    });
    expect(parsed.ADMIN_EMAILS).toBe("");
  });
});
