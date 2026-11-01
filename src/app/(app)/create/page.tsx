import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/States";
import { QueueRow } from "@/components/content/QueueRow";
import { FormatSchema, ContentPreviewSchema } from "@/lib/schemas/content";
import { parseReadParams } from "@/lib/schemas/read-params";
import { todayInIst } from "@/lib/utils/dates";
import { ReadFilters } from "@/features/content/ReadFilters";
import { ScopeControl } from "@/features/content/ScopeControl";
import { TrackedTick } from "@/features/content/TrackedTick";
import { getCreateQueue } from "@/server/db/queries";

const groups = {
  carousel: "Carousels",
  reel: "Reels",
  post: "Posts",
  story: "Stories",
  meme: "Memes",
  poll: "Polls",
};
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseReadParams(await searchParams);
  const items = await getCreateQueue(params);
  const today = todayInIst();
  const overdue = items.filter((item) => item.scheduled_date < today);
  return (
    <>
      <PageHeader title="Create" />
      <ScopeControl params={params} mode="create" />
      <ReadFilters path="/create" params={params} />
      {!items.length ? (
        <EmptyState
          glyph={params.platform || params.format ? "filter" : "layers"}
          statement={
            params.platform || params.format
              ? "No items match these filters."
              : "Nothing waiting to be designed."
          }
          guidance="Everything planned has been posted or skipped."
          action={{
            label:
              params.platform || params.format
                ? "Clear filters"
                : "See the calendar",
            href: params.platform || params.format ? "/create" : "/calendar",
          }}
        />
      ) : null}
      {overdue.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-eyebrow font-semibold text-danger uppercase">
            Overdue · {overdue.length}
          </h2>
          <ul className="space-y-3">
            {overdue.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                overdue
                tick={<TrackedTick item={ContentPreviewSchema.parse(item)} />}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {FormatSchema.options.map((format) => {
        const group = items.filter(
          (item) => item.format === format && item.scheduled_date >= today,
        );
        return group.length ? (
          <section key={format} className="mt-8">
            <h2 className="mb-3 text-eyebrow font-semibold text-secondary uppercase">
              {groups[format]} · {group.length}
            </h2>
            <ul className="space-y-3">
              {group.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  tick={<TrackedTick item={ContentPreviewSchema.parse(item)} />}
                />
              ))}
            </ul>
          </section>
        ) : null;
      })}
    </>
  );
}
