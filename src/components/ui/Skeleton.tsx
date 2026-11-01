import { cx } from "@/lib/utils/cx";

type SkeletonProps = {
  /** Geometry classes copied from the real component (height, radius, width). */
  className?: string;
};

// Shape-accurate placeholder (DESIGN.md §6.6). The shimmer is a static fill
// under reduced motion.
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-skeleton=""
      className={cx(
        "bg-skeleton bg-[linear-gradient(90deg,transparent,var(--skeleton-highlight),transparent)] bg-size-[200%_100%] bg-no-repeat",
        "animate-shimmer motion-reduce:animate-none motion-reduce:bg-none",
        className,
      )}
    />
  );
}
