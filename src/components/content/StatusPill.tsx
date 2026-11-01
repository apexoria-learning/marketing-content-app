import type { ContentStatus } from "@/lib/schemas/content";
import { Icon } from "../ui/Icon";
import { cx } from "@/lib/utils/cx";
export function StatusPill({
  status,
  overdue = false,
}: {
  status: ContentStatus;
  overdue?: boolean;
}) {
  const label = overdue
    ? "Overdue"
    : { idea: "Planned", ready: "Ready", posted: "Posted", skipped: "Skipped" }[
        status
      ];
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-pill px-3 py-1 text-eyebrow font-semibold uppercase",
        overdue
          ? "bg-danger-muted text-danger"
          : status === "posted"
            ? "bg-accent-muted text-accent"
            : "e2 text-secondary",
      )}
    >
      {overdue || status === "posted" ? (
        <Icon name={overdue ? "alert" : "check"} size="chip" />
      ) : null}
      <span
        className={cx(
          "min-w-0 break-words",
          status === "skipped" && "line-through",
          status === "posted" && !overdue && "text-primary",
        )}
      >
        {label}
      </span>
    </span>
  );
}
