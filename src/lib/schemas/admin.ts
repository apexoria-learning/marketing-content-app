import { z } from "zod";
import { PillarSchema } from "./content";

// Admin panel contracts (API.md §5.5). Single definition for both the
// client-side pre-check and the server action.

export const AppRoleSchema = z.enum(["member", "admin"]);
export type AppRole = z.infer<typeof AppRoleSchema>;

export const AccessEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));

export const AccessRecordSchema = z.object({
  role: AppRoleSchema,
  is_active: z.boolean(),
  can_generate: z.boolean(),
});
export type AccessRecord = z.infer<typeof AccessRecordSchema>;

export const AppUserSchema = AccessRecordSchema.extend({
  email: z.string().min(3),
  created_at: z.string(),
  created_by: z.string().nullable(),
  updated_at: z.string(),
  updated_by: z.string().nullable(),
});
export type AppUser = z.infer<typeof AppUserSchema>;

export const GrantAccessInputSchema = z
  .object({
    email: AccessEmailSchema,
    role: AppRoleSchema,
    can_generate: z.boolean(),
  })
  .strict();
export type GrantAccessInput = z.infer<typeof GrantAccessInputSchema>;

export const UpdateAccessInputSchema = z
  .object({
    email: AccessEmailSchema,
    role: AppRoleSchema.optional(),
    is_active: z.boolean().optional(),
    can_generate: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.role !== undefined ||
      value.is_active !== undefined ||
      value.can_generate !== undefined,
    "Choose a change to make.",
  );
export type UpdateAccessInput = z.infer<typeof UpdateAccessInputSchema>;

export const ImportAllowlistInputSchema = z.object({}).strict();

// The gateway receives the server-held API key, so only credential-free
// HTTPS /v1 endpoints are accepted (API.md §8.1).
export const GatewayBaseUrlSchema = z
  .url()
  .max(500)
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
  }, "Must be an HTTPS v1 endpoint without credentials, query or fragment");

export const AiModelSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[\w.@:/-]+$/, "Use the gateway's model alias exactly.");

export const FeedUrlSchema = z
  .url()
  .max(500)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Feeds must be HTTPS addresses without credentials.");

// News can be omitted when feeds are empty, so three other pillars must remain
// for the no-adjacent-repeat planning rule (ARCHITECTURE.md §4.4).
export const MIN_TOPIC_PILLARS = 3;

const isUnique = (values: readonly string[]) =>
  new Set(values).size === values.length;

export const EnabledPillarsSchema = z
  .array(PillarSchema)
  .max(PillarSchema.options.length)
  .refine(isUnique, "Each pillar may appear once.")
  .refine(
    (pillars) =>
      pillars.filter((pillar) => pillar !== "salesforce_news").length >=
      MIN_TOPIC_PILLARS,
    `Keep at least ${MIN_TOPIC_PILLARS} pillars other than News.`,
  );

export const AppSettingsUpdateSchema = z
  .object({
    ai_generation_enabled: z.boolean().nullable().optional(),
    regen_daily_limit: z.number().int().min(1).max(1000).nullable().optional(),
    global_daily_ai_limit: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .nullable()
      .optional(),
    plan_day_of_month: z.number().int().min(1).max(31).nullable().optional(),
    planning_horizon_months: z
      .number()
      .int()
      .min(1)
      .max(12)
      .nullable()
      .optional(),
    ai_model: AiModelSchema.nullable().optional(),
    ai_base_url: GatewayBaseUrlSchema.nullable().optional(),
    news_feed_urls: z
      .array(FeedUrlSchema)
      .max(25)
      .refine(isUnique, "Each feed may appear once.")
      .nullable()
      .optional(),
    enabled_pillars: EnabledPillarsSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Choose a setting to change.",
  );
export type AppSettingsUpdate = z.infer<typeof AppSettingsUpdateSchema>;

export const AppSettingsRowSchema = z.object({
  ai_generation_enabled: z.boolean().nullable(),
  regen_daily_limit: z.number().int().nullable(),
  global_daily_ai_limit: z.number().int().nullable(),
  plan_day_of_month: z.number().int().nullable(),
  planning_horizon_months: z.number().int().nullable(),
  ai_model: z.string().nullable(),
  ai_base_url: z.string().nullable(),
  news_feed_urls: z.array(z.string()).nullable(),
  enabled_pillars: z.array(PillarSchema).nullable(),
  updated_at: z.string(),
  updated_by: z.string().nullable(),
});
export type AppSettingsRow = z.infer<typeof AppSettingsRowSchema>;

export const PromptScopeSchema = z.enum(["content", "planning", "daily_tip"]);
export type PromptScope = z.infer<typeof PromptScopeSchema>;

export const EDITORIAL_INSTRUCTIONS_MAX = 2000;

export const SaveInstructionsInputSchema = z
  .object({
    scope: PromptScopeSchema,
    instructions: z
      .string()
      .trim()
      .max(
        EDITORIAL_INSTRUCTIONS_MAX,
        "Keep instructions under 2,000 characters.",
      ),
  })
  .strict();
export type SaveInstructionsInput = z.infer<typeof SaveInstructionsInputSchema>;

export const PromptInstructionSchema = z.object({
  id: z.number().int().positive(),
  scope: PromptScopeSchema,
  instructions: z.string(),
  created_at: z.string(),
  created_by: z.string().nullable(),
});
export type PromptInstruction = z.infer<typeof PromptInstructionSchema>;
