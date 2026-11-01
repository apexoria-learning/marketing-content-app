import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/States";
import { ContentCard } from "@/components/content/ContentCard";
import { ActivityList } from "@/components/content/ActivityList";
import { PLATFORM_LABELS } from "@/components/content/PlatformBadge";
import { PILLAR_LABELS } from "@/components/content/PillarChip";
import {
  PlatformSchema,
  PillarSchema,
  ContentPreviewSchema,
} from "@/lib/schemas/content";
import { ReadFilters } from "@/features/content/ReadFilters";
import { ScopeControl } from "@/features/content/ScopeControl";
import { TrackedTick } from "@/features/content/TrackedTick";
import { parseReadParams } from "@/lib/schemas/read-params";
import { getActivity, getArchive } from "@/server/db/queries";

export const metadata: Metadata = { title: "Archive" };

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseReadParams(raw);
  const { items, summary, nextCursor } = await getArchive(params, raw.cursor);
  const activity = await getActivity(items.map((item) => item.id));
  const next = new URLSearchParams({ scope: params.scope });
  if (params.platform) next.set("platform", params.platform);
  if (params.pillar) next.set("pillar", params.pillar);
  if (params.format) next.set("format", params.format);
  if (nextCursor) next.set("cursor", nextCursor);
  return (
    <>
      <PageHeader title="Archive" />
      <ScopeControl params={params} mode="archive" />
      <ReadFilters path="/archive" params={params} />
      <section aria-label="Archive summary" className="my-8 space-y-3">
        <h2 className="font-display text-h2 font-semibold">
          {summary.total} posted in this scope
        </h2>
        <dl className="flex flex-wrap gap-3 text-sm text-secondary">
          {PlatformSchema.options.map((platform) => (
            <div key={platform}>
              <dt>{PLATFORM_LABELS[platform]}</dt>
              <dd>{summary.platforms[platform]}</dd>
            </div>
          ))}
        </dl>
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-secondary">
            Counts by pillar
          </summary>
          <dl className="space-y-2 text-sm text-secondary">
            {PillarSchema.options.map((pillar) => (
              <div key={pillar} className="flex gap-2">
                <dt>{PILLAR_LABELS[pillar]}</dt>
                <dd>{summary.pillars[pillar]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
      {!items.length ? (
        <EmptyState
          glyph={
            params.platform || params.pillar || params.format
              ? "filter"
              : "archive"
          }
          statement={
            params.platform || params.pillar || params.format
              ? "No items match these filters."
              : "Nothing posted yet."
          }
          guidance="Mark your first post and it'll show up here."
          action={{
            label:
              params.platform || params.pillar || params.format
                ? "Clear filters"
                : "Go to Today",
            href:
              params.platform || params.pillar || params.format
                ? `/archive?scope=${params.scope}`
                : "/",
          }}
        />
      ) : null}
      <ol className="space-y-8">
        {items.map((item) => (
          <li key={item.id}>
            <ContentCard
              item={item}
              condensed
              tick={<TrackedTick item={ContentPreviewSchema.parse(item)} />}
            />
            <details className="mt-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm text-secondary">
                History & notes
              </summary>
              <ActivityList
                activity={activity.filter(
                  (event) => event.content_item_id === item.id,
                )}
              />
            </details>
          </li>
        ))}
      </ol>
      {nextCursor ? (
        <a
          href={`/archive?${next}`}
          className="mt-8 inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface-2 px-5 text-sm font-semibold"
        >
          Next 30 posts
        </a>
      ) : null}
    </>
  );
}
