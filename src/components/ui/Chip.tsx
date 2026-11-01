import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/utils/cx";
import { Icon } from "./Icon";

type ChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-pressed"
> & {
  selected?: boolean;
};

// Toggle chip used by FilterBar and example-steer chips (DESIGN.md §6.4).
// Selection is shape (leading tick) + colour + aria-pressed, never colour alone.
export function Chip({
  selected = false,
  className,
  children,
  type = "button",
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-pill border px-4 text-sm font-medium",
        "transition-colors duration-(--motion-fast) ease-standard active:scale-97",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-40",
        selected
          ? "border-border-strong bg-accent-muted text-primary"
          : "border-border bg-surface-2 text-secondary hover:text-primary",
        className,
      )}
      {...props}
    >
      {selected ? <Icon name="check" size="chip" /> : null}
      {children}
    </button>
  );
}
