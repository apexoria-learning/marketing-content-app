import Link from "next/link";
import type { ReactNode } from "react";
import type { ContentItem } from "@/lib/schemas/content";
import { displayDate } from "@/lib/utils/dates";
import { PlatformName } from "./PlatformBadge";
import { PillarName } from "./PillarChip";
import { Icon } from "../ui/Icon";
import { cx } from "@/lib/utils/cx";
export function QueueRow({
  item,
  tick,
  overdue = false,
}: {
  item: ContentItem;
  tick?: ReactNode;
  overdue?: boolean;
}) {
  return (
    <li
      className={cx(
        "e1 flex min-w-0 items-center gap-3 rounded-md p-3",
        overdue && "border-l-2 border-l-danger",
      )}
    >
      <Icon
        name={item.format}
        className="size-10 rounded-sm bg-surface-2 p-2 text-secondary"
      />
      <Link
        href={`/item/${item.id}`}
        prefetch={false}
        className="min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-accent"
      >
        <h3 className="line-clamp-2 text-sm font-medium text-primary">
          {item.hook ?? item.idea}
        </h3>
        <p
          className={cx(
            "mt-1 text-caption",
            overdue ? "text-danger" : "text-secondary",
          )}
        >
          {displayDate(item.scheduled_date)} ·{" "}
          <PlatformName platform={item.platform} /> ·{" "}
          <PillarName pillar={item.pillar} />
          {overdue ? " · Overdue" : ""}
        </p>
      </Link>
      {tick}
    </li>
  );
}
