import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  parseFeed,
  normalizeArticleUrl,
} from "../../src/server/news/parse-feed";
import {
  isPublicFeedAddress,
  validateFeedUrl,
} from "../../src/server/news/fetch-feed";
import { ingestNews } from "../../src/server/news";

const rss = `<rss><channel><title>Salesforce</title><item>
<title>News</title><link>https://Example.com/article/?utm_source=feed</link>
<description><![CDATA[<p>Plain summary</p>]]></description>
</item></channel></rss>`;

describe("news ingestion", () => {
  it("normalizes tracking variants to the same hash and handles missing dates", () => {
    const article = parseFeed(rss, "https://feed.example.com/rss")[0];
    expect(article).toMatchObject({
      title: "News",
      source: "Salesforce",
      url: "https://example.com/article",
      published_at: null,
      summary: "Plain summary",
    });
    expect(
      normalizeArticleUrl("https://EXAMPLE.com/article/?utm_medium=x#top"),
    ).toBe(article?.url);
    expect(
      parseFeed(
        rss.replace("utm_source=feed", "utm_medium=x"),
        "https://feed.example.com/rss",
      )[0]?.url_hash,
    ).toBe(article?.url_hash);
  });

  it("supports Atom and empty feeds", () => {
    expect(
      parseFeed(
        "<rss><channel><title>Empty</title></channel></rss>",
        "https://feed.example.com",
      ),
    ).toEqual([]);
    expect(
      parseFeed(
        `<feed><title>Publisher</title><entry><title>Article</title>
      <link href="https://example.com/a" rel="alternate"/><updated>2026-11-01T00:00:00Z</updated>
      </entry></feed>`,
        "https://feed.example.com",
      )[0],
    ).toMatchObject({
      url: "https://example.com/a",
      published_at: "2026-11-01T00:00:00.000Z",
    });
  });

  it("rejects malformed XML, external entities and executable article URLs", () => {
    expect(() => parseFeed("<rss>", "https://example.com")).toThrow();
    expect(() =>
      parseFeed(
        '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
        "https://example.com",
      ),
    ).toThrow(/declarations/);
    expect(() =>
      parseFeed(
        rss.replace(
          "https://Example.com/article/?utm_source=feed",
          "javascript:alert(1)",
        ),
        "https://example.com",
      ),
    ).toThrow();
  });

  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "224.0.0.1",
    "::1",
  ])("refuses non-public feed address %s", (address) => {
    expect(isPublicFeedAddress(address)).toBe(false);
  });

  it("accepts public addresses and refuses non-HTTPS or credential-bearing feeds", () => {
    expect(isPublicFeedAddress("8.8.8.8")).toBe(true);
    expect(() => validateFeedUrl("http://example.com")).toThrow();
    expect(() =>
      validateFeedUrl("https://user:password@example.com"),
    ).toThrow();
  });

  it("isolates a failing feed and skips parsing/upsert on 304", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce({ xml: rss, validators: { etag: "v1" } })
      .mockResolvedValueOnce({ xml: null, validators: { etag: "v1" } });
    const repository = { upsert: vi.fn(), prune: vi.fn(), record: vi.fn() };
    const validators = new Map();
    const results = await ingestNews(
      [
        "https://failed.example.com",
        "https://working.example.com",
        "https://unchanged.example.com",
      ],
      repository,
      {
        retentionDays: 30,
        validators,
        now: new Date("2026-11-01T00:00:00Z"),
        fetch,
      },
    );
    expect(results.map((result) => result.status)).toEqual([
      "failed",
      "success",
      "success",
    ]);
    expect(repository.upsert).toHaveBeenCalledTimes(1);
    expect(repository.record).toHaveBeenCalledTimes(3);
    expect(validators.get("https://working.example.com")).toEqual({
      etag: "v1",
    });
    expect(repository.prune).toHaveBeenCalledWith("2026-10-02T00:00:00.000Z");
  });
});
