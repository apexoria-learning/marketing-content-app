import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import { Spinner } from "./Spinner";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "inline" | "action";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** `action` is the 52px action-bar height; `inline` is 44px. */
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "rounded-pill bg-accent px-5 text-accent-on hover:bg-accent-hover",
  secondary:
    "rounded-pill border border-border bg-surface-2 px-5 text-primary hover:border-border-strong",
  ghost:
    "rounded-pill px-4 text-secondary hover:bg-surface-2 hover:text-primary",
  danger: "rounded-pill bg-danger-muted px-5 text-danger",
  icon: "size-11 rounded-pill text-secondary hover:bg-surface-2 hover:text-primary",
};

const sizeClasses: Record<ButtonSize, string> = {
  inline: "min-h-11",
  action: "min-h-13",
};

// States (DESIGN.md §6.4): hover is desktop-only (Tailwind v4 gates `hover:`
// behind `(hover: hover)`), pressed scales to 0.97 over `instant`, loading
// keeps the label in layout so width never shifts.
export function Button({
  className,
  variant = "primary",
  size = "inline",
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "relative inline-flex min-w-11 items-center justify-center gap-2 text-sm font-semibold",
        "transition-[transform,background-color,color,border-color] duration-(--motion-instant) ease-linear active:scale-97",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-40 aria-busy:opacity-100",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      <span
        className={cx(
          "inline-flex items-center justify-center gap-2",
          // opacity (not visibility) keeps the accessible name while busy.
          loading && "opacity-0",
        )}
      >
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}
