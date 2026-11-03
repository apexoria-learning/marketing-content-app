"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  navigateReadPage,
  restoreReadFocus,
} from "@/lib/utils/read-navigation";
import type { ContentPreview } from "@/lib/schemas/content";
import type { ReadParams } from "@/lib/schemas/read-params";
import {
  displayDate,
  monthBounds,
  shiftDate,
  shiftMonth,
} from "@/lib/utils/dates";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ContentCard } from "@/components/content/ContentCard";
import {
  PlatformBadge,
  PlatformName,
} from "@/components/content/PlatformBadge";
import { usePlatformCatalogue } from "@/components/content/PlatformCatalogue";
import { TrackedTick } from "../content/TrackedTick";
import { EmptyState } from "@/components/feedback/States";
import { cx } from "@/lib/utils/cx";

export function CalendarView({
  params,
  items,
  today,
}: {
  params: ReadParams;
  items: ContentPreview[];
  today: string;
}) {
  useEffect(() => restoreReadFocus(), []);
  const catalogue = usePlatformCatalogue();
  const legend = catalogue.filter(
    (platform) =>
      platform.is_enabled ||
      items.some((item) => item.platform === platform.key),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const touch = useRef({ x: 0, y: 0 });
  const { start, end } = monthBounds(params.month);
  const first = new Date(`${start}T00:00:00Z`);
  const days = new Date(`${end}T00:00:00Z`).getTime() - first.getTime();
  const dates = Array.from({ length: days / 86_400_000 }, (_, index) =>
    shiftDate(start, index),
  );
  const padding = (first.getUTCDay() + 6) % 7;
  function navigate(offset: number) {
    const search = new URLSearchParams({
      month: shiftMonth(params.month, offset),
    });
    if (params.platform) search.set("platform", params.platform);
    if (params.pillar) search.set("pillar", params.pillar);
    if (params.status) search.set("status", params.status);
    navigateReadPage(
      "/calendar",
      search,
      offset > 0 ? "calendar-month-next" : "calendar-month-previous",
    );
    setSelected(null);
  }
  function indicators(date: string) {
    return items
      .filter((item) => item.scheduled_date === date)
      .map((item) => (
        <span key={item.id} className="inline-flex items-center gap-1">
          <PlatformBadge
            platform={item.platform}
            variant="dot"
            hollow={item.status !== "posted"}
          />
          <Icon
            name={item.status === "posted" ? "check" : "minus"}
            size="spinner"
            className={
              item.status === "posted" ? "text-accent" : "text-secondary"
            }
          />
          <span className="sr-only">{item.status}</span>
        </span>
      ));
  }
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="icon"
          aria-label="Previous month"
          id="calendar-month-previous"
          onClick={() => navigate(-1)}
        >
          <Icon name="chevron-left" />
        </Button>
        <h2 className="font-display text-h2 font-semibold">
          {displayDate(start, { month: "long", year: "numeric" })}
        </h2>
        <Button
          variant="icon"
          aria-label="Next month"
          id="calendar-month-next"
          onClick={() => navigate(1)}
        >
          <Icon name="chevron-right" />
        </Button>
      </div>
      <div
        onTouchStart={(event) => {
          const point = event.touches[0];
          if (point) touch.current = { x: point.clientX, y: point.clientY };
        }}
        onTouchEnd={(event) => {
          const point = event.changedTouches[0];
          if (
            point &&
            Math.abs(point.clientX - touch.current.x) > 64 &&
            Math.abs(point.clientY - touch.current.y) < 40
          )
            navigate(point.clientX < touch.current.x ? 1 : -1);
        }}
      >
        <div
          className="calendar-grid mt-4 grid-cols-7 gap-2"
          aria-label="Month grid"
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day} className="text-center text-eyebrow text-secondary">
              {day}
            </span>
          ))}
          {Array.from({ length: padding }, (_, index) => (
            <span key={`pad-${index}`} aria-hidden="true" />
          ))}
          {dates.map((date) => (
            <button
              key={date}
              onClick={() => setSelected(date)}
              aria-label={displayDate(date, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              aria-current={date === today ? "date" : undefined}
              className={cx(
                "flex min-h-16 min-w-11 flex-col items-center justify-between gap-2 rounded-sm border border-border bg-surface-1 p-1 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-accent",
                date === today && "border-accent",
              )}
            >
              {Number(date.slice(8))}
              <span className="flex flex-wrap gap-1">
                {indicators(date)}
                {!items.some((item) => item.scheduled_date === date) ? (
                  <span className="text-secondary">—</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
        <ol
          className="calendar-agenda mt-4 space-y-3"
          aria-label="Month agenda"
        >
          {dates.map((date) => (
            <li key={date}>
              <button
                onClick={() => setSelected(date)}
                aria-current={date === today ? "date" : undefined}
                className={cx(
                  "e1 flex min-h-13 w-full flex-wrap items-center justify-between gap-3 rounded-md p-3 text-sm focus-visible:outline-2 focus-visible:outline-accent",
                  date === today && "border-accent",
                )}
              >
                <span>
                  {displayDate(date, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="flex flex-wrap gap-2">
                  {indicators(date)}
                  {!items.some((item) => item.scheduled_date === date)
                    ? "Nothing scheduled"
                    : null}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <aside
        aria-label="Calendar legend"
        className="mt-4 flex flex-wrap gap-3 text-caption text-secondary"
      >
        {legend.map(({ key }) => (
          <span key={key} className="inline-flex items-center gap-1">
            <PlatformBadge platform={key} variant="dot" />
            <PlatformName platform={key} />
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <Icon name="minus" size="spinner" />
          Pending
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="check" size="spinner" />
          Posted
        </span>
      </aside>
      <BottomSheet
        open={selected !== null}
        title={
          selected
            ? displayDate(selected, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : "Day details"
        }
        onClose={() => setSelected(null)}
      >
        <div className="space-y-4">
          {items
            .filter((item) => item.scheduled_date === selected)
            .map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                condensed
                tick={<TrackedTick item={item} />}
              />
            ))}
          {!items.some((item) => item.scheduled_date === selected) ? (
            <EmptyState
              glyph="plus-circle"
              statement="Nothing scheduled."
              guidance="AI generation for a day is available in a later phase."
            />
          ) : null}
          <Link
            href="/create"
            className="inline-flex min-h-11 items-center text-sm text-secondary"
          >
            See design queue
          </Link>
        </div>
      </BottomSheet>
    </>
  );
}
