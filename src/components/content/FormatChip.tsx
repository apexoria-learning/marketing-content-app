import type { ContentFormat } from "@/lib/schemas/content";
import { Icon } from "../ui/Icon";
export const FORMAT_LABELS: Record<ContentFormat, string> = {
  carousel: "Carousel",
  reel: "Reel",
  post: "Post",
  story: "Story",
  meme: "Meme",
  poll: "Poll",
};
export function FormatChip({ format }: { format: ContentFormat }) {
  return (
    <span className="e2 inline-flex max-w-full items-center gap-1 rounded-sm px-2 py-1 text-eyebrow font-semibold text-secondary uppercase">
      <Icon name={format} size="chip" />
      <span className="min-w-0 break-words">{FORMAT_LABELS[format]}</span>
    </span>
  );
}
