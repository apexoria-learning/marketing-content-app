import { z } from "zod";
import { tryParseUrl } from "../utils/url";

// Industry-neutral business profile (DATABASE.md §5.1, US-16). Every field
// feeds AI prompts as reference data, so each one is bounded: an unbounded
// field is both a cost and a prompt-injection vector.

const text = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);
const listEntry = z.string().trim().min(1).max(200);
const isUnique = (values: readonly string[]) =>
  new Set(values.map((value) => value.toLocaleLowerCase("en"))).size ===
  values.length;
const list = (label: string) =>
  z
    .array(listEntry)
    .max(40, `Keep ${label} to 40 entries.`)
    .refine(isUnique, `Each ${label} entry may appear once.`);

export const LinkUrlSchema = z
  .url({ protocol: /^https?$/, message: "Use a full http(s) address." })
  .max(500)
  .refine((value) => {
    const url = tryParseUrl(value);
    return url === null || (!url.username && !url.password);
  }, "Links must not contain credentials.");

export const ProfileLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    url: LinkUrlSchema,
  })
  .strict();
export type ProfileLink = z.infer<typeof ProfileLinkSchema>;

export const BusinessProfileInputSchema = z
  .object({
    business_name: text(120, "Enter the business name."),
    industry: text(120, "Describe the industry in a few words."),
    business_description: text(2000, "Describe what the business does."),
    audience_description: text(2000, "Describe who the content is for."),
    offerings_label: text(30, "Name what you offer, e.g. Courses."),
    offerings: list("offerings"),
    current_offers: z
      .string()
      .trim()
      .max(2000)
      .transform((value) => value || null),
    tip_topic: text(200, "Name the topic for the daily tip."),
    do_list: list("do"),
    dont_list: list("don't"),
    links: z
      .array(ProfileLinkSchema)
      .max(20, "Keep links to 20.")
      .refine(
        (links) => isUnique(links.map((link) => link.label)),
        "Each link name may appear once.",
      ),
  })
  .strict();
export type BusinessProfileInput = z.input<typeof BusinessProfileInputSchema>;
export type BusinessProfile = z.output<typeof BusinessProfileInputSchema>;

/** The stored profile as admins see it, including attribution. */
export const BusinessProfileRecordSchema = z.object({
  business_name: z.string(),
  industry: z.string(),
  business_description: z.string(),
  audience_description: z.string(),
  offerings_label: z.string(),
  courses: z.array(z.string()),
  current_offers: z.string().nullable(),
  tip_topic: z.string(),
  do_list: z.array(z.string()),
  dont_list: z.array(z.string()),
  links: z.record(z.string(), z.string()),
  updated_at: z.string(),
  updated_by: z.string().nullable(),
});
export type BusinessProfileRecord = z.infer<typeof BusinessProfileRecordSchema>;

/** Form values for a stored profile; `courses` is the offerings list. */
export function toBusinessProfileInput(
  record: BusinessProfileRecord,
): BusinessProfileInput {
  return {
    business_name: record.business_name,
    industry: record.industry,
    business_description: record.business_description,
    audience_description: record.audience_description,
    offerings_label: record.offerings_label,
    offerings: record.courses,
    current_offers: record.current_offers ?? "",
    tip_topic: record.tip_topic,
    do_list: record.do_list,
    dont_list: record.dont_list,
    links: Object.entries(record.links).map(([label, url]) => ({ label, url })),
  };
}

/** One entry per line; blank lines ignored. */
export function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** `Name: https://…` per line; a line without a name is kept for validation. */
export function parseLinkLines(value: string): ProfileLink[] {
  return parseLines(value).map((line) => {
    const match = /^(.+?):\s+(\S+)$/.exec(line);
    return match
      ? { label: match[1]?.trim() ?? "", url: match[2] ?? "" }
      : { label: "", url: line };
  });
}

export function formatLinkLines(links: readonly ProfileLink[]): string {
  return links.map((link) => `${link.label}: ${link.url}`).join("\n");
}
