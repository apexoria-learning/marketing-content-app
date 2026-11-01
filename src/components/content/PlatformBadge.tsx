import type { Platform } from "@/lib/schemas/content";
import { Icon } from "../ui/Icon";
import { cx } from "@/lib/utils/cx";

export const PLATFORM_LABELS = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp Status",
};
const colors = {
  instagram: "text-platform-instagram bg-platform-instagram-muted",
  linkedin: "text-platform-linkedin bg-platform-linkedin-muted",
  whatsapp: "text-platform-whatsapp bg-platform-whatsapp-muted",
};
export function PlatformBadge({
  platform,
  variant = "full",
  hollow = false,
}: {
  platform: Platform;
  variant?: "dot" | "compact" | "full";
  hollow?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-pill",
        colors[platform],
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
        <Icon name={platform} size="chip" />
      )}
      <span
        className={
          variant === "full" ? "min-w-0 break-words text-primary" : "sr-only"
        }
      >
        {PLATFORM_LABELS[platform]}
      </span>
    </span>
  );
}
