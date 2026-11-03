import { z } from "zod";
import type { Metadata } from "next";
import {
  ContentPreviewSchema,
  ItemControlsSchema,
} from "@/lib/schemas/content";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { ActionBar } from "@/components/shell/ActionBar";
import { PlatformBadge } from "@/components/content/PlatformBadge";
import { FormatChip } from "@/components/content/FormatChip";
import { PillarChip } from "@/components/content/PillarChip";
import { StatusPill } from "@/components/content/StatusPill";
import { CopyBlock } from "@/components/content/CopyBlock";
import { SlideList } from "@/components/content/SlideList";
import { ScriptList } from "@/components/content/ScriptList";
import { BriefSection } from "@/components/content/BriefSection";
import { SourceList } from "@/components/content/SourceList";
import { ActivityList } from "@/components/content/ActivityList";
import { Banner } from "@/components/feedback/Banner";
import { TrackedTick } from "@/features/content/TrackedTick";
import { ItemActions } from "@/features/content/ItemActions";
import { GenerationControl } from "@/features/content/GenerationControl";
import { getViewerCapabilities } from "@/server/services/viewer-capabilities";
import { getPillarDisplays } from "@/server/services/pillar-display";
import { pillarDisplayFor } from "@/lib/schemas/pillars";
import { displayDate, displayTimestamp } from "@/lib/utils/dates";
import { hasHydratedContent } from "@/lib/utils/status";
import { getActivity, getItem, withPosterNames } from "@/server/db/queries";

export const metadata: Metadata = { title: "Content details" };
// hydrateItem/regenerateItem run from this route within a 240s budget.
export const maxDuration = 300;

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const item = await getItem(parsed.data);
  if (!item) notFound();
  const activity = await getActivity([item.id]);
  const postedByName =
    (await withPosterNames([item]))[0]?.posted_by_name ?? null;
  const { canGenerate } = await getViewerCapabilities();
  const pillar = pillarDisplayFor(await getPillarDisplays(), item.pillar);
  return (
    <>
      <PageHeader
        back
        title="Content details"
        heading={false}
        actions={<StatusPill status={item.status} />}
      />
      <div className="my-4 flex flex-wrap items-center gap-2">
        <PlatformBadge platform={item.platform} />
        <FormatChip format={item.format} />
        <PillarChip pillar={item.pillar} />
        <time
          dateTime={item.scheduled_date}
          className="text-caption text-secondary"
        >
          {displayDate(item.scheduled_date)}
        </time>
      </div>
      <h1 className="mb-4 whitespace-pre-wrap font-display text-h1 font-semibold text-primary">
        {item.hook ?? item.idea}
      </h1>
      {item.status === "posted" && item.posted_at ? (
        <p className="mb-4 text-sm text-secondary">
          Posted by {postedByName ?? item.posted_by} ·{" "}
          {displayTimestamp(item.posted_at)} IST. Content is read-only; un-tick
          to return it to ready.
        </p>
      ) : null}
      {item.skip_reason ? (
        <p className="mb-4 whitespace-pre-wrap text-body text-secondary">
          Skip reason: {item.skip_reason}
        </p>
      ) : null}
      {item.status === "idea" || !item.body ? (
        <Banner variant={item.generation_error ? "danger" : "neutral"}>
          This is a planned idea, not finished content.
          {item.generation_error
            ? " Generation didn't complete. Try generating again."
            : " Generate it to prepare the caption and design brief."}
        </Banner>
      ) : null}
      <div className="mt-8 space-y-8">
        {item.caption ? (
          <CopyBlock label="Caption" text={item.caption} />
        ) : null}
        {item.format === "carousel" && item.body ? (
          <SlideList body={item.body} />
        ) : null}
        {item.format === "reel" && item.body ? (
          <ScriptList body={item.body} />
        ) : null}
        {item.format === "post" && item.body ? (
          <CopyBlock label="Visual concept" text={item.body.visual_concept} />
        ) : null}
        {item.format === "story" && item.body ? (
          <>
            <CopyBlock label="Story frame" text={item.body.frame} />
            <CopyBlock
              label="Interaction prompt"
              text={item.body.interaction_prompt}
            />
          </>
        ) : null}
        {item.format === "meme" && item.body ? (
          <>
            <CopyBlock label="Meme template" text={item.body.template} />
            <CopyBlock
              label="Meme text"
              text={`${item.body.top_text}\n\n${item.body.bottom_text}`}
            />
          </>
        ) : null}
        {item.format === "poll" && item.body ? (
          <CopyBlock
            label="Poll"
            text={`${item.body.question}\n\n${item.body.options.map((option, index) => `${index + 1}. ${option}`).join("\n")}`}
          />
        ) : null}
        {item.hashtags.length ? (
          <CopyBlock label="Hashtags" text={item.hashtags.join(" ")} mono />
        ) : null}
        {item.cta ? <CopyBlock label="Call to action" text={item.cta} /> : null}
        {item.design_brief ? <BriefSection brief={item.design_brief} /> : null}
        <SourceList sources={item.source_refs} isNews={pillar.requires_news} />
        <ItemActions
          item={ItemControlsSchema.parse({
            ...item,
            is_hydrated: hasHydratedContent(item),
          })}
        />
        {item.status !== "posted" ? (
          <GenerationControl
            key={item.id}
            enabled={canGenerate}
            auto={
              item.status === "idea" &&
              !hasHydratedContent(item) &&
              !item.generation_error
            }
            target={{
              kind: hasHydratedContent(item) ? "regenerate" : "hydrate",
              itemId: item.id,
            }}
          />
        ) : null}
        <ActivityList activity={activity} />
      </div>
      {["ready", "posted"].includes(item.status) ? (
        <ActionBar>
          <TrackedTick item={ContentPreviewSchema.parse(item)} />
          <span className="text-sm font-semibold">
            {item.status === "posted"
              ? "Posted · un-tick to undo"
              : "Mark as posted"}
          </span>
        </ActionBar>
      ) : null}
    </>
  );
}
