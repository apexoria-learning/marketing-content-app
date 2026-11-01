import Link from "next/link";
import type { ReactNode } from "react";
import type { ContentPreview } from "@/lib/schemas/content";
import { displayDate, displayTimestamp } from "@/lib/utils/dates";
import { PlatformBadge } from "./PlatformBadge";
import { FormatChip } from "./FormatChip";
import { PillarChip } from "./PillarChip";
import { StatusPill } from "./StatusPill";
import { cx } from "@/lib/utils/cx";

export function ContentCard({
  item,
  tick,
  condensed = false,
  isPosted = item.status === "posted",
}: {
  item: ContentPreview;
  tick?: ReactNode;
  condensed?: boolean;
  isPosted?: boolean;
}) {
  return (
    <article
      data-status={isPosted ? "posted" : item.status}
      className={cx(
        "e1 relative rounded-xl",
        isPosted && "border-accent/40 bg-surface-sunken!",
        condensed ? "p-4" : "p-6",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <PlatformBadge platform={item.platform} />
        <FormatChip format={item.format} />
        <PillarChip pillar={item.pillar} />
        <StatusPill
          status={
            isPosted
              ? "posted"
              : item.status === "posted"
                ? "ready"
                : item.status
          }
        />
      </div>
      <Link
        href={`/item/${item.id}`}
        prefetch={false}
        className="mt-4 block rounded-md focus-visible:outline-2 focus-visible:outline-accent"
      >
        <h2 className="line-clamp-3 font-display text-h2 font-semibold text-primary">
          {item.hook ?? item.idea}
        </h2>
        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-body text-secondary">
          {item.caption ??
            "Planned idea. Full content generation is available in a later phase."}
        </p>
        <span className="sr-only">Open content details</span>
      </Link>
      <footer className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <time
          dateTime={item.scheduled_date}
          className="text-caption text-secondary"
        >
          {displayDate(item.scheduled_date)}
        </time>
        {tick}
      </footer>
      {isPosted && item.posted_at ? (
        <p className="mt-2 text-caption text-secondary">
          Posted by {item.posted_by} ·{" "}
          <time dateTime={item.posted_at}>
            {displayTimestamp(item.posted_at)} IST
          </time>
        </p>
      ) : null}
    </article>
  );
}
