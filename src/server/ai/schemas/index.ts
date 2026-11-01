import "server-only";
import { z } from "zod";
import {
  CarouselBodySchema,
  DesignBriefSchema,
  FormatSchema,
  MemeBodySchema,
  PillarSchema,
  PlatformSchema,
  PollBodySchema,
  PostBodySchema,
  ReelBodySchema,
  SourceRefSchema,
  StoryBodySchema,
} from "../../../lib/schemas/content";

const authoredText = z.string().trim().min(1).max(10000);
const fields = z.object({
  title: authoredText,
  hook: authoredText,
  caption: authoredText,
  hashtags: z.array(z.string().trim().min(1).max(100)).max(30),
  cta: authoredText,
  design_brief: DesignBriefSchema,
  source_refs: z.array(SourceRefSchema).max(20),
});

export const GeneratedContentSchema = z.discriminatedUnion("format", [
  fields
    .extend({ format: z.literal("carousel"), body: CarouselBodySchema })
    .strict(),
  fields.extend({ format: z.literal("reel"), body: ReelBodySchema }).strict(),
  fields.extend({ format: z.literal("post"), body: PostBodySchema }).strict(),
  fields.extend({ format: z.literal("story"), body: StoryBodySchema }).strict(),
  fields.extend({ format: z.literal("meme"), body: MemeBodySchema }).strict(),
  fields.extend({ format: z.literal("poll"), body: PollBodySchema }).strict(),
]);

export const GenerationContextSchema = z
  .object({
    platform: PlatformSchema,
    format: FormatSchema,
    pillar: PillarSchema,
    idea: z.string().trim().min(1).max(2000),
    brand: z
      .object({
        business_name: authoredText,
        business_description: authoredText,
        audience_description: authoredText,
        courses: z.array(authoredText).max(40),
        current_offers: authoredText.nullable(),
        tone: authoredText,
        do_list: z.array(authoredText).max(40),
        dont_list: z.array(authoredText).max(40),
        links: z.record(z.string(), z.url()),
      })
      .strict(),
    news: z
      .array(
        SourceRefSchema.extend({
          summary: z.string().max(10000).nullable(),
        }).strict(),
      )
      .max(20),
    recent_ideas: z.array(z.string().max(2000)),
    pillar_history: z.array(PillarSchema).max(120),
    steer: z.string().trim().max(500).optional(),
  })
  .strict();

export type GenerationContext = z.infer<typeof GenerationContextSchema>;
export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;
