import "server-only";
import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";

const ArticleSchema = z.object({
  source: z.string().trim().min(1),
  title: z.string().trim().min(1).max(1000),
  url: z.url({ protocol: /^https?$/ }).refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  }),
  url_hash: z.string().length(64),
  published_at: z.iso.datetime({ offset: true }).nullable(),
  summary: z.string().max(10000).nullable(),
});
export type NewsArticle = z.infer<typeof ArticleSchema>;

function plainText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit)
    : "";
}

export function normalizeArticleUrl(raw: string) {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Invalid news article URL.");
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key))
      url.searchParams.delete(key);
  }
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  url.searchParams.sort();
  return url.href;
}

const NodeSchema = z.record(z.string(), z.unknown());
function nodes(value: unknown) {
  if (value === undefined) return [];
  return z.array(NodeSchema).parse(Array.isArray(value) ? value : [value]);
}

export function parseFeed(xml: string, feedUrl: string): NewsArticle[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("Feed document declarations are not permitted.");
  if (XMLValidator.validate(xml) !== true)
    throw new Error("Malformed news feed.");
  const decoded: unknown = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    parseTagValue: false,
    trimValues: true,
  }).parse(xml);
  const root = NodeSchema.parse(decoded);
  const atom =
    root.feed === undefined ? undefined : NodeSchema.parse(root.feed);
  const rss = root.rss === undefined ? undefined : NodeSchema.parse(root.rss);
  const channel = rss ? NodeSchema.parse(rss.channel) : undefined;
  if (!atom && !channel) throw new Error("Unsupported news feed.");
  const source =
    plainText((atom ?? channel)?.title, 200) || new URL(feedUrl).hostname;
  const entries = nodes(atom ? atom.entry : channel?.item).slice(0, 100);
  return entries.map((entry) => {
    let link: unknown = entry.link;
    if (atom) {
      const alternate = nodes(entry.link).find(
        (candidate) =>
          candidate["@_rel"] === undefined ||
          candidate["@_rel"] === "alternate",
      );
      link = alternate?.["@_href"];
    }
    const rawUrl = z.string().min(1).parse(link);
    const url = normalizeArticleUrl(new URL(rawUrl, feedUrl).href);
    const dateValue = entry.pubDate ?? entry.published ?? entry.updated;
    const published =
      typeof dateValue === "string" ? new Date(dateValue) : null;
    return ArticleSchema.parse({
      source,
      title: plainText(entry.title, 1000),
      url,
      url_hash: createHash("sha256").update(url).digest("hex"),
      published_at:
        published && Number.isFinite(published.getTime())
          ? published.toISOString()
          : null,
      summary:
        plainText(entry.description ?? entry.summary ?? entry.content, 10000) ||
        null,
    });
  });
}
