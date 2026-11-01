import { z } from "zod";

// Canonical variable list: ARCHITECTURE.md §11, API.md §10.
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORTKEY_API_KEY: z.string().min(1),
  PORTKEY_BASE_URL: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        /\/v1\/?$/.test(url.pathname)
      );
    }, "Must be an HTTPS v1 endpoint without credentials, query or fragment")
    .default("https://portkeygateway.perficient.com/v1"),
  AI_MODEL: z.string().min(1),
  CRON_SECRET: z.string().min(32),
  ALLOWED_EMAILS: z.string().default(""),
  NEWS_FEED_URLS: z
    .string()
    .default(
      "https://www.salesforce.com/news/feed/,https://www.salesforceben.com/feed/",
    ),
  NEWS_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PLAN_DAY_OF_MONTH: z.coerce.number().int().min(1).max(31).default(25),
  REGEN_DAILY_LIMIT: z.coerce.number().int().positive().default(20),
  GLOBAL_DAILY_AI_LIMIT: z.coerce.number().int().positive().default(100),
  PLANNING_HORIZON_MONTHS: z.coerce.number().int().positive().default(2),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses environment configuration, throwing a message that names each
 * offending variable. Values are never echoed — a malformed secret must not
 * reach a log line (API.md §10.1).
 */
export function parseEnv(source: unknown): Env {
  const result = envSchema.safeParse(source);

  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .sort()
    .join("; ");

  throw new Error(`Invalid environment configuration — ${problems}`);
}
