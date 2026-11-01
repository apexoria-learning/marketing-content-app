import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/server/config/env-schema";

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  PORTKEY_API_KEY: "portkey-key",
  AI_MODEL: "claude-sonnet",
  CRON_SECRET: "x".repeat(32),
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
};

describe("parseEnv", () => {
  it("accepts a valid set and applies documented defaults", () => {
    const env = parseEnv(VALID_ENV);

    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://app.example.com");
    expect(env.PLAN_DAY_OF_MONTH).toBe(25);
    expect(env.REGEN_DAILY_LIMIT).toBe(20);
    expect(env.GLOBAL_DAILY_AI_LIMIT).toBe(100);
    expect(env.PLANNING_HORIZON_MONTHS).toBe(2);
    expect(env.ALLOWED_EMAILS).toBe("");
    expect(env.NEWS_FEED_URLS).toBe("");
    expect(env.NEWS_RETENTION_DAYS).toBe(30);
    expect(env.PORTKEY_BASE_URL).toBe(
      "https://portkeygateway.perficient.com/v1",
    );
  });

  it("rejects a missing required variable and names it", () => {
    const withoutCronSecret: Record<string, unknown> = { ...VALID_ENV };

    delete withoutCronSecret.CRON_SECRET;

    expect(() => parseEnv(withoutCronSecret)).toThrowError(/CRON_SECRET/);
  });

  it("accepts model-alias routing without a virtual key or config ID", () => {
    const env = parseEnv({
      ...VALID_ENV,
      PORTKEY_BASE_URL: "https://gateway.example.com/v1",
      AI_MODEL: "@dsvertex/anthropic.claude-sonnet-5-5",
    });

    expect(env.PORTKEY_BASE_URL).toBe("https://gateway.example.com/v1");
    expect(env.AI_MODEL).toBe("@dsvertex/anthropic.claude-sonnet-5-5");
  });

  it.each([
    "http://gateway.example.com/v1",
    "https://user:password@gateway.example.com/v1",
    "https://gateway.example.com/v1?key=secret",
    "https://gateway.example.com/v1#fragment",
    "https://gateway.example.com",
  ])("rejects an unsafe or incomplete gateway endpoint: %s", (baseURL) => {
    expect(() =>
      parseEnv({ ...VALID_ENV, PORTKEY_BASE_URL: baseURL }),
    ).toThrowError(/PORTKEY_BASE_URL/);
  });

  it("rejects a malformed URL", () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a cron secret that is too short to be unguessable", () => {
    expect(() => parseEnv({ ...VALID_ENV, CRON_SECRET: "short" })).toThrowError(
      /CRON_SECRET/,
    );
  });

  it("rejects an out-of-range planning day", () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, PLAN_DAY_OF_MONTH: "32" }),
    ).toThrowError(/PLAN_DAY_OF_MONTH/);
  });

  it("rejects an invalid retention period before ingestion can prune", () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, NEWS_RETENTION_DAYS: "0" }),
    ).toThrowError(/NEWS_RETENTION_DAYS/);
  });

  it("coerces numeric configuration supplied as strings", () => {
    const env = parseEnv({ ...VALID_ENV, REGEN_DAILY_LIMIT: "5" });

    expect(env.REGEN_DAILY_LIMIT).toBe(5);
  });

  it("never echoes the offending value", () => {
    const secret = "y".repeat(10);

    let message = "";

    try {
      parseEnv({ ...VALID_ENV, CRON_SECRET: secret });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("CRON_SECRET");
    expect(message).not.toContain(secret);
  });
});
