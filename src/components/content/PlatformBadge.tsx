"use client";

import { Icon } from "../ui/Icon";
import { cx } from "@/lib/utils/cx";
import { toPlatformIcon } from "@/lib/schemas/platforms";
import { usePlatformDisplay } from "./PlatformCatalogue";

// Static class map: Tailwind only generates classes it can see (§3.2 slots).
export const PLATFORM_SLOT_CLASSES: Record<number, string> = {
  1: "text-platform-1 bg-platform-1-muted",
  2: "text-platform-2 bg-platform-2-muted",
  3: "text-platform-3 bg-platform-3-muted",
  4: "text-platform-4 bg-platform-4-muted",
  5: "text-platform-5 bg-platform-5-muted",
  6: "text-platform-6 bg-platform-6-muted",
  7: "text-platform-7 bg-platform-7-muted",
  8: "text-platform-8 bg-platform-8-muted",
};
const UNKNOWN_SLOT_CLASSES = "text-secondary bg-surface-2";

export function PlatformBadge({
  platform,
  variant = "full",
  hollow = false,
}: {
  platform: string;
  variant?: "dot" | "compact" | "full";
  hollow?: boolean;
}) {
  const display = usePlatformDisplay(platform);
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-pill",
        PLATFORM_SLOT_CLASSES[display.colour_slot] ?? UNKNOWN_SLOT_CLASSES,
        variant === "full" && "px-3 py-1 text-sm font-medium",
      )}
    >
      {variant === "dot" ? (
        <span
          className={cx(
            "size-2 rounded-pill",
            hollow ? "border-2 border-current" : "bg-current",
          )}
          aria-hidden="true"
        />
      ) : (
        <Icon name={toPlatformIcon(display.icon)} size="chip" />
      )}
      <span
        className={
          variant === "full" ? "min-w-0 break-words text-primary" : "sr-only"
        }
      >
        {display.label}
      </span>
    </span>
  );
}

/** The platform's catalogue label as plain text. */
export function PlatformName({ platform }: { platform: string }) {
  return <>{usePlatformDisplay(platform).label}</>;
}
