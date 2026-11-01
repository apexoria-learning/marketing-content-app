import Link from "next/link";
import { cx } from "@/lib/utils/cx";

type ProgressRingProps = {
  posted: number;
  planned: number;
  href?: string;
  label?: string;
  className?: string;
};

const RADIUS = 24;

// Month progress (DESIGN.md §6.4). The arc length is an SVG attribute, so the
// CSS transition animates it without inline styles; reduced motion snaps.
export function ProgressRing({
  posted,
  planned,
  href = "/calendar",
  label = "Posted",
  className,
}: ProgressRingProps) {
  const ratio = planned > 0 ? Math.min(posted / planned, 1) : 0;

  return (
    <Link
      href={href}
      className={cx(
        "inline-flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-md",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <span className="relative inline-flex size-14 items-center justify-center">
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 size-14"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="28"
            cy="28"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            className="stroke-border"
          />
          <circle
            cx="28"
            cy="28"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - ratio}
            transform="rotate(-90 28 28)"
            data-ratio={ratio}
            className={cx(
              "stroke-accent transition-[stroke-dashoffset] duration-(--motion-base) ease-standard motion-reduce:transition-none",
              ratio === 0 && "opacity-0",
            )}
          />
        </svg>
        <span className="relative text-h3 font-semibold text-primary tabular-nums">
          {posted}
        </span>
      </span>
      {/* Visible text leads the accessible name (WCAG 2.5.3). */}
      <span className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
        {label}
        <span className="sr-only">
          {` of ${planned} this month. Open calendar.`}
        </span>
      </span>
    </Link>
  );
}
