import "server-only";
import { z } from "zod";
import { fetchFeed, type FeedValidators } from "./fetch-feed";
import { parseFeed, type NewsArticle } from "./parse-feed";

export async function ingestNews(
  feeds: string[],
  repository: {
    upsert: (articles: NewsArticle[]) => Promise<void>;
    prune: (before: string) => Promise<void>;
    record: (result: {
      status: "success" | "failed";
      items_processed: number;
      error: string | null;
    }) => Promise<void>;
  },
  options: {
    retentionDays: number;
    validators: Map<string, FeedValidators>;
    now: Date;
    fetch?: typeof fetchFeed;
  },
) {
  z.array(z.url()).max(25).parse(feeds);
  const retentionDays = z
    .number()
    .int()
    .min(1)
    .max(365)
    .parse(options.retentionDays);
  const now = z.date().parse(options.now);
  const results: { status: "success" | "failed"; items_processed: number }[] =
    [];
  for (const feed of feeds) {
    let count = 0;
    let failure = false;
    try {
      const response = await (options.fetch ?? fetchFeed)(
        feed,
        options.validators.get(feed),
      );
      if (response.xml !== null) {
        const articles = parseFeed(response.xml, feed);
        await repository.upsert(articles);
        count = articles.length;
      }
      options.validators.set(feed, response.validators);
    } catch {
      console.error("News feed ingestion failed.", {
        feedHost: new URL(feed).hostname,
      });
      failure = true;
    }
    await repository.record({
      status: failure ? "failed" : "success",
      items_processed: count,
      error: failure ? "News feed ingestion failed." : null,
    });
    results.push({
      status: failure ? "failed" : "success",
      items_processed: count,
    });
  }
  await repository.prune(
    new Date(now.getTime() - retentionDays * 86400000).toISOString(),
  );
  return results;
}
