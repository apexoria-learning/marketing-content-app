import { z } from "zod";

export const PlatformSchema = z.enum(["instagram", "linkedin", "whatsapp"]);
export const FormatSchema = z.enum([
  "carousel",
  "reel",
  "post",
  "story",
  "meme",
  "poll",
]);
export const PillarSchema = z.enum([
  "salesforce_tips",
  "salesforce_news",
  "memes",
  "interview_questions",
  "success_stories",
  "course_promos",
  "career_guidance",
  "behind_the_scenes",
  "myth_busting",
  "polls_engagement",
]);
export const StatusSchema = z.enum(["idea", "ready", "posted", "skipped"]);
const text = z.string().min(1);
const timestamp = z.iso.datetime({ offset: true });
export const SourceRefSchema = z
  .object({
    title: text,
    url: z
      .url({ protocol: /^https?$/ })
      .refine((value) => !new URL(value).username && !new URL(value).password),
    source: text,
  })
  .strict();
export const DesignBriefSchema = z
  .object({
    objective: text,
    visual_direction: text,
    layout_notes: text,
    typography: text,
    must_include: z.array(text),
    must_avoid: z.array(text),
    specs: z
      .object({
        dimensions: text,
        aspect_ratio: text,
        safe_area: text,
        slide_count: z.number().int().positive().nullable(),
      })
      .strict(),
  })
  .strict();
export const CarouselBodySchema = z
  .object({
    slides: z
      .array(
        z
          .object({
            index: z.number().int().positive(),
            headline: text,
            body: text,
            visual_note: text.nullable(),
          })
          .strict(),
      )
      .min(1)
      .refine((slides) =>
        slides.every((slide, index) => slide.index === index + 1),
      ),
  })
  .strict();
const timecode = z.string().regex(/^\d{1,2}:[0-5]\d$/);
function seconds(value: string) {
  const [minutes, remainder] = value.split(":").map(Number);
  return (minutes ?? 0) * 60 + (remainder ?? 0);
}
export const ReelBodySchema = z
  .object({
    duration_seconds: z.number().int().positive(),
    scenes: z
      .array(
        z
          .object({
            from: timecode,
            to: timecode,
            action: text,
            on_screen_text: text,
          })
          .strict(),
      )
      .min(1),
    audio: text,
  })
  .strict()
  .refine(({ scenes, duration_seconds }) =>
    scenes.every(
      (scene, index) =>
        seconds(scene.to) > seconds(scene.from) &&
        seconds(scene.to) <= duration_seconds &&
        (index === 0 ||
          seconds(scene.from) >= seconds(scenes[index - 1]?.to ?? "0:00")),
    ),
  );
export const PostBodySchema = z.object({ visual_concept: text }).strict();
export const StoryBodySchema = z
  .object({ frame: text, interaction_prompt: text })
  .strict();
export const MemeBodySchema = z
  .object({ template: text, top_text: text, bottom_text: text })
  .strict();
export const PollBodySchema = z
  .object({
    question: text,
    options: z
      .array(text)
      .min(2)
      .max(4)
      .refine((values) => new Set(values).size === values.length),
  })
  .strict();
const base = z.object({
  id: z.uuid(),
  plan_id: z.uuid().nullable(),
  scheduled_date: z.iso.date(),
  slot: z.number().int().min(1).max(2),
  platform: PlatformSchema,
  pillar: PillarSchema,
  idea: text,
  title: z.string().nullable(),
  hook: z.string().nullable(),
  caption: z.string().nullable(),
  hashtags: z.array(z.string()),
  cta: z.string().nullable(),
  design_brief: DesignBriefSchema.nullable(),
  source_refs: z.array(SourceRefSchema),
  status: StatusSchema,
  posted_at: timestamp.nullable(),
  posted_by: z.string().nullable(),
  skip_reason: z.string().nullable(),
  regenerated_count: z.number().int().nonnegative(),
  prompt_version: z.string().nullable(),
  generation_error: z.string().nullable(),
  hydrated_at: timestamp.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});
export const ContentItemSchema = z
  .discriminatedUnion("format", [
    base.extend({
      format: z.literal("carousel"),
      body: CarouselBodySchema.nullable(),
    }),
    base.extend({ format: z.literal("reel"), body: ReelBodySchema.nullable() }),
    base.extend({ format: z.literal("post"), body: PostBodySchema.nullable() }),
    base.extend({
      format: z.literal("story"),
      body: StoryBodySchema.nullable(),
    }),
    base.extend({ format: z.literal("meme"), body: MemeBodySchema.nullable() }),
    base.extend({ format: z.literal("poll"), body: PollBodySchema.nullable() }),
  ])
  .superRefine((item, context) => {
    const allowed = {
      carousel: ["instagram", "linkedin"],
      reel: ["instagram"],
      post: ["instagram", "linkedin"],
      story: ["instagram", "whatsapp"],
      meme: ["instagram", "whatsapp"],
      poll: ["instagram", "linkedin"],
    };
    if (!allowed[item.format].includes(item.platform))
      context.addIssue({
        code: "custom",
        message: "Incompatible platform and format",
        path: ["platform"],
      });
    if (
      ["ready", "posted"].includes(item.status) &&
      (!item.hook?.trim() ||
        !item.caption?.trim() ||
        !item.body ||
        !item.design_brief ||
        !item.hydrated_at)
    )
      context.addIssue({
        code: "custom",
        message: "Usable content must be hydrated",
        path: ["status"],
      });
    if (
      (item.status === "posted") !==
      Boolean(item.posted_at && item.posted_by)
    )
      context.addIssue({
        code: "custom",
        message: "Inconsistent posted attribution",
        path: ["posted_at"],
      });
    if (item.status !== "skipped" && item.skip_reason !== null)
      context.addIssue({
        code: "custom",
        message: "Skip reason belongs to skipped content",
        path: ["skip_reason"],
      });
    if (item.platform === "whatsapp" && item.hashtags.length)
      context.addIssue({
        code: "custom",
        message: "WhatsApp has no hashtags",
        path: ["hashtags"],
      });
  });
export const DailyTipSchema = z.object({
  id: z.uuid(),
  tip_date: z.iso.date(),
  tip: text,
  category: z.string().nullable(),
  prompt_version: z.string().nullable(),
  created_at: timestamp,
});
export const MonthSkeletonSchema = z.object({
  id: z.uuid(),
  plan_month: z.iso.date().refine((value) => value.endsWith("-01")),
  status: z.enum(["pending", "generating", "complete", "failed"]),
  model: z.string().nullable(),
  prompt_version: z.string().nullable(),
  generated_at: timestamp.nullable(),
  created_at: timestamp,
});
export const ActivitySchema = z.object({
  id: z.number().int(),
  content_item_id: z.uuid(),
  action: z.enum([
    "created",
    "hydrated",
    "regenerated",
    "status_changed",
    "note_added",
  ]),
  from_value: z.string().nullable(),
  to_value: z.string().nullable(),
  actor_email: z.string().nullable(),
  // Presentation only: Google display name for actor_email, when available.
  actor_name: z.string().nullable().optional(),
  note: z.string().nullable(),
  created_at: timestamp,
});
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type ContentFormat = z.infer<typeof FormatSchema>;
export type Pillar = z.infer<typeof PillarSchema>;
export type ContentStatus = z.infer<typeof StatusSchema>;
export type DesignBrief = z.infer<typeof DesignBriefSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type DailyTip = z.infer<typeof DailyTipSchema>;
export type MonthSkeleton = z.infer<typeof MonthSkeletonSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export const ContentPreviewSchema = base
  .pick({
    id: true,
    scheduled_date: true,
    slot: true,
    platform: true,
    pillar: true,
    idea: true,
    hook: true,
    caption: true,
    status: true,
    posted_at: true,
    posted_by: true,
  })
  .extend({
    format: FormatSchema,
    // Presentation only: Google display name for posted_by, when available.
    posted_by_name: z.string().nullable().optional(),
  });
export const ItemControlsSchema = ContentPreviewSchema.extend({
  is_hydrated: z.boolean(),
});
export type ContentPreview = z.infer<typeof ContentPreviewSchema>;
export type ItemControls = z.infer<typeof ItemControlsSchema>;
