import Link from "next/link";
import { cx } from "@/lib/utils/cx";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";

export type StateAction = {
  label: string;
  href?: string;
  onAction?: () => void;
};

type StateProps = {
  glyph: IconName;
  statement: string;
  guidance?: string;
  /** Never more than one action (DESIGN.md §6.6). */
  action?: StateAction;
  className?: string;
};

const actionClasses =
  "inline-flex min-h-11 items-center justify-center rounded-pill border border-border bg-surface-2 px-5 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function StateLayout({
  glyph,
  statement,
  guidance,
  action,
  tone,
  className,
}: StateProps & { tone: "neutral" | "danger" }) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-4 px-5 py-12 text-center",
        className,
      )}
    >
      <Icon
        name={glyph}
        size="empty"
        className={tone === "danger" ? "text-danger" : "text-tertiary"}
      />
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-h2 font-semibold tracking-h2 text-primary">
          {statement}
        </h2>
        {guidance ? <p className="text-sm text-secondary">{guidance}</p> : null}
      </div>
      {action ? (
        action.href ? (
          <Link href={action.href} className={actionClasses}>
            {action.label}
          </Link>
        ) : (
          <Button variant="secondary" onClick={action.onAction}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateLayout {...props} tone="neutral" />;
}

type ErrorStateProps = Omit<StateProps, "glyph" | "action"> & {
  glyph?: IconName;
  onRetry?: () => void;
  retryLabel?: string;
};

// Plain-language statement, one recovery action, no technical detail (§9.3).
export function ErrorState({
  glyph = "alert",
  onRetry,
  retryLabel = "Try again",
  ...props
}: ErrorStateProps) {
  return (
    <div role="alert">
      <StateLayout
        {...props}
        glyph={glyph}
        tone="danger"
        action={onRetry ? { label: retryLabel, onAction: onRetry } : undefined}
      />
    </div>
  );
}
