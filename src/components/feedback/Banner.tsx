import type { ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";

type BannerVariant = "neutral" | "accent" | "danger";

type BannerProps = {
  variant?: BannerVariant;
  children: ReactNode;
  icon?: IconName;
  /** Shows an indeterminate progress strip (month generation running). */
  progress?: boolean;
  action?: { label: string; onAction: () => void };
  /** Only pass for informational state; persistent problems are not dismissible. */
  onDismiss?: () => void;
  className?: string;
};

const variantClasses: Record<BannerVariant, string> = {
  neutral: "border-border bg-surface-2 text-primary",
  accent: "border-border-strong bg-accent-muted text-primary",
  danger: "border-danger bg-danger-muted text-danger",
};

const defaultIcons: Record<BannerVariant, IconName> = {
  neutral: "cloud-off",
  accent: "sparkle",
  danger: "alert",
};

// Persistent background state at the top of the content area (DESIGN.md §6.4).
export function Banner({
  variant = "neutral",
  children,
  icon,
  progress,
  action,
  onDismiss,
  className,
}: BannerProps) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cx(
        "relative flex items-center gap-3 overflow-hidden rounded-lg border py-2 pr-2 pl-4",
        variantClasses[variant],
        className,
      )}
    >
      <Icon
        name={icon ?? defaultIcons[variant]}
        className={variant === "accent" ? "text-accent" : undefined}
      />
      <p className="flex-1 py-2 text-sm">{children}</p>
      {action ? (
        <Button
          variant="ghost"
          className={variant === "danger" ? "text-danger!" : "text-primary!"}
          onClick={action.onAction}
        >
          {action.label}
        </Button>
      ) : null}
      {onDismiss ? (
        <Button variant="icon" aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="close" size="chip" />
        </Button>
      ) : null}
      {progress ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
        >
          <span className="block h-full w-2/5 animate-indeterminate bg-accent motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40" />
        </span>
      ) : null}
    </div>
  );
}
