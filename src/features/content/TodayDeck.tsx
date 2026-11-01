"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import type { ContentPreview } from "@/lib/schemas/content";
import { ContentCard } from "@/components/content/ContentCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PageHeader } from "@/components/shell/PageHeader";
import { ActionBar } from "@/components/shell/ActionBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/feedback/States";
import { StatusTick } from "@/components/ui/StatusTick";
import { usePosting } from "./use-posting";
import { SignOutControl } from "../shell/PwaControls";
import { cx } from "@/lib/utils/cx";

export function TodayDeck({
  items,
  progress,
  dateLabel,
  tomorrow,
  tip,
}: {
  items: ContentPreview[];
  progress: { posted: number; planned: number };
  dateLabel: string;
  tomorrow: string;
  tip: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const { statuses, pending, save } = usePosting(items);
  const list = useRef<HTMLUListElement>(null);
  const reducedMotion = useReducedMotion();
  const posted =
    progress.posted +
    items.reduce(
      (sum, item) =>
        sum + Number(statuses[item.id]) - Number(item.status === "posted"),
      0,
    );
  const allDone = items.length > 0 && items.every((item) => statuses[item.id]);
  const [showDone, setShowDone] = useState(allDone);
  const [celebrate, setCelebrate] = useState(false);
  const hasCelebrated = useRef(false);
  useEffect(() => {
    if (!allDone) {
      setShowDone(false);
      setCelebrate(false);
      return;
    }
    if (showDone) return;
    const timer = setTimeout(() => {
      setShowDone(true);
      setCelebrate(!hasCelebrated.current);
      hasCelebrated.current = true;
    }, 400);
    return () => clearTimeout(timer);
  }, [allDone, showDone]);
  const activeItem = items[index];
  function go(next: number) {
    const bounded = Math.max(0, Math.min(items.length - 1, next));
    setIndex(bounded);
    const child = list.current?.children[bounded];
    if (child instanceof HTMLElement && reducedMotion)
      child.scrollIntoView({ behavior: "instant", block: "nearest" });
    else if (child instanceof HTMLElement)
      list.current?.scrollTo({
        left:
          child.offsetLeft -
          (list.current.firstElementChild instanceof HTMLElement
            ? list.current.firstElementChild.offsetLeft
            : 0),
        behavior: reducedMotion ? "instant" : "smooth",
      });
  }
  return (
    <>
      <PageHeader
        title={dateLabel}
        actions={<ProgressRing posted={posted} planned={progress.planned} />}
      />
      <div className="mb-4 flex justify-end">
        <SignOutControl />
      </div>
      {tip}
      <p role="status" className="sr-only">
        {posted} of {progress.planned} posted this month.
      </p>
      {showDone ? (
        <EmptyState
          glyph="check-circle"
          statement="All done for today."
          guidance={`${posted} of ${progress.planned} posted this month.`}
          action={{
            label: "See tomorrow",
            href: `/calendar?month=${tomorrow.slice(0, 7)}`,
          }}
          className={celebrate ? "all-done" : undefined}
        />
      ) : null}
      <section className="mt-8" aria-label="Today's content">
        <h2 className="mb-4 text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
          Today&apos;s content · {items.length}
        </h2>
        {items.length === 0 ? (
          <EmptyState
            glyph="calendar-plus"
            statement="No content planned for today."
            guidance="AI planning is available in a later phase. Existing scheduled content remains available in Calendar."
            action={{ label: "See the calendar", href: "/calendar" }}
          />
        ) : (
          <>
            <ul
              ref={list}
              aria-label="Today's content cards"
              className={items.length > 1 ? "today-deck" : "space-y-6"}
              onScroll={() => {
                const element = list.current;
                if (element && items.length > 1)
                  setIndex(
                    Math.min(
                      items.length - 1,
                      Math.round(
                        element.scrollLeft /
                          ((element.firstElementChild?.clientWidth ?? 1) + 12),
                      ),
                    ),
                  );
              }}
              onKeyDown={(event) => {
                if (
                  event.target !== event.currentTarget &&
                  event.target instanceof HTMLElement &&
                  event.target.tagName !== "A"
                )
                  return;
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  go(index + (event.key === "ArrowRight" ? 1 : -1));
                }
              }}
            >
              {items.map((item) => (
                <li key={item.id}>
                  <ContentCard
                    item={item}
                    isPosted={statuses[item.id]}
                    tick={
                      <StatusTick
                        checked={statuses[item.id] ?? false}
                        hook={item.hook ?? item.idea}
                        disabled={
                          pending || !["ready", "posted"].includes(item.status)
                        }
                        onCheckedChange={(value) => save(item.id, value)}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
            {items.length > 1 ? (
              <div
                className="mt-3 flex justify-center gap-2"
                aria-label="Choose content card"
              >
                {items.map((item, position) => (
                  <Button
                    key={item.id}
                    variant="icon"
                    aria-label={`Show content ${position + 1}`}
                    aria-pressed={index === position}
                    onClick={() => go(position)}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        "size-2 rounded-pill",
                        index === position ? "bg-accent" : "bg-secondary",
                      )}
                    />
                  </Button>
                ))}
              </div>
            ) : null}
            {activeItem && ["ready", "posted"].includes(activeItem.status) ? (
              <ActionBar>
                <Button
                  size="action"
                  loading={pending}
                  onClick={() => save(activeItem.id, !statuses[activeItem.id])}
                >
                  {statuses[activeItem.id]
                    ? "Return to ready"
                    : "Mark as posted"}
                </Button>
              </ActionBar>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
