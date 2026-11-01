import { PageHeader } from "@/components/shell/PageHeader";
import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/States";
import { Banner } from "@/components/feedback/Banner";
import { CalendarView } from "@/features/calendar/CalendarView";
import { ReadFilters } from "@/features/content/ReadFilters";
import { parseReadParams } from "@/lib/schemas/read-params";
import { ContentPreviewSchema } from "@/lib/schemas/content";
import { todayInIst } from "@/lib/utils/dates";
import { getMonthItems, getMonthPlan } from "@/server/db/queries";
import { GenerationControl } from "@/features/content/GenerationControl";
import { env } from "@/server/config/env";
import { isMonthWithinHorizon } from "@/lib/utils/planning-rules";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseReadParams(await searchParams);
  const [items, plan] = await Promise.all([
    getMonthItems(params),
    getMonthPlan(params.month),
  ]);
  return (
    <>
      <PageHeader title="Calendar" />
      <ReadFilters path="/calendar" params={params} />
      {plan?.status === "generating" ? (
        <Banner variant="accent" progress>
          Month planning is in progress.
        </Banner>
      ) : null}
      {!plan && !items.length ? (
        <EmptyState
          glyph="sparkle"
          statement="This month isn't planned yet."
          guidance="Plan the month to prepare your content ideas."
        />
      ) : null}
      {!plan &&
      isMonthWithinHorizon(
        params.month,
        todayInIst(),
        env.PLANNING_HORIZON_MONTHS,
      ) ? (
        <GenerationControl
          enabled={env.AI_GENERATION_ENABLED === "true"}
          target={{ kind: "month", month: params.month }}
        />
      ) : null}
      {plan &&
      !items.length &&
      (params.platform || params.pillar || params.status) ? (
        <EmptyState
          glyph="filter"
          statement="No items match these filters."
          action={{
            label: "Clear filters",
            href: `/calendar?month=${params.month}`,
          }}
        />
      ) : null}
      <CalendarView
        params={params}
        items={items.map((item) => ContentPreviewSchema.parse(item))}
        today={todayInIst()}
      />
    </>
  );
}
