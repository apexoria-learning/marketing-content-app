import type { SourceRef } from "@/lib/schemas/content";
import { Banner } from "../feedback/Banner";
import { Icon } from "../ui/Icon";
export function SourceList({
  sources,
  isNews,
}: {
  sources: SourceRef[];
  isNews: boolean;
}) {
  if (!sources.length)
    return isNews ? (
      <Banner variant="danger">
        This news item has no sources. Do not publish it as verified news.
      </Banner>
    ) : null;
  return (
    <section>
      <h2 className="font-display text-h2 font-semibold">Sources</h2>
      <ul className="mt-3 space-y-3">
        {sources.map((source, index) => (
          <li key={index}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-between gap-3 rounded-md py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span>
                {source.title}
                <span className="block text-caption text-secondary">
                  {source.source} · {new URL(source.url).hostname} · Opens in a
                  new tab
                </span>
              </span>
              <Icon name="external-link" size="chip" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
