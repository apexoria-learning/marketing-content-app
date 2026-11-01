import type { Activity } from "@/lib/schemas/content";
import { displayTimestamp } from "@/lib/utils/dates";
export function ActivityList({ activity }: { activity: Activity[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-h2 font-semibold">History & notes</h2>
      {activity.length ? (
        <ol className="space-y-3">
          {activity.map((event) => (
            <li key={event.id} className="rounded-md bg-surface-sunken p-3">
              <p className="whitespace-pre-wrap text-body text-primary">
                {event.note ??
                  (event.action === "status_changed"
                    ? `${event.from_value} → ${event.to_value}`
                    : event.action.replaceAll("_", " "))}
              </p>
              <p className="mt-1 break-words text-caption text-secondary">
                {event.actor_email ?? "System"} ·{" "}
                <time dateTime={event.created_at}>
                  {displayTimestamp(event.created_at)} IST
                </time>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-secondary">No activity recorded yet.</p>
      )}
    </section>
  );
}
