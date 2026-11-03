import "server-only";
import {
  GeneratedContentSchema,
  GenerationContextSchema,
  type GenerationContext,
} from "./schemas";

export class AiOutputError extends Error {
  constructor(
    readonly issues: string[],
    readonly stage: "parse" | "schema" | "business" = "business",
  ) {
    super("Generated content did not pass validation.");
    this.name = "AiOutputError";
  }
}

export function validateGeneratedContent(
  raw: string,
  input: GenerationContext,
) {
  const context = GenerationContextSchema.parse(input);
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new AiOutputError(
      ["Return a valid JSON object, without markdown fences."],
      "parse",
    );
  }
  const parsed = GeneratedContentSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new AiOutputError(
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.code}`)
        .slice(0, 20),
      "schema",
    );
  }
  const content = parsed.data;
  const issues: string[] = [];
  if (content.format !== context.format)
    issues.push("format: must match the requested format");
  const rules = context.platform_rules;
  const hashtagLimit = rules.allows_hashtags ? rules.max_hashtags : 0;
  if (content.hashtags.length > hashtagLimit)
    issues.push(
      hashtagLimit === 0
        ? `hashtags: ${rules.label} requires an empty array`
        : `hashtags: ${rules.label} allows at most ${hashtagLimit}`,
    );
  if (
    rules.caption_max_chars !== null &&
    content.caption.length > rules.caption_max_chars
  )
    issues.push(
      `caption: ${rules.label} allows at most ${rules.caption_max_chars} characters`,
    );
  const sources = new Map(
    context.news.map((article) => [article.url, article]),
  );
  content.source_refs = content.source_refs.flatMap((reference) => {
    const source = sources.get(reference.url);
    return source
      ? [{ title: source.title, source: source.source, url: source.url }]
      : [];
  });
  if (context.pillar_rules.requires_news && !content.source_refs.length)
    issues.push("source_refs: news content requires a supplied source URL");
  if (issues.length) throw new AiOutputError(issues);
  return content;
}
