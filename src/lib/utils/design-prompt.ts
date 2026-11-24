import { BRAND_KIT_PROMPT } from "../constants/brand-kit";
import type { ContentFormat, ContentItem } from "../schemas/content";

const GRAPHIC_FORMATS: ReadonlySet<ContentFormat> = new Set([
  "carousel",
  "post",
  "story",
  "meme",
  "poll",
]);

/** Formats produced as a still graphic; reels, Shorts and videos are filmed. */
export function isGraphicFormat(format: ContentFormat) {
  return GRAPHIC_FORMATS.has(format);
}

export type DesignPromptBlock = { label: string; text: string };

function withBrandKit(prompt: string) {
  return `${prompt}\n\n${BRAND_KIT_PROMPT}`;
}

/**
 * Paste-ready image prompts for an item's graphics, one per carousel slide.
 * Empty for filmed formats and for items hydrated before content-v4.
 */
export function designPromptBlocks(item: ContentItem): DesignPromptBlock[] {
  if (!item.body) return [];
  switch (item.format) {
    case "carousel":
      return item.body.slides.flatMap((slide) =>
        slide.design_prompt
          ? [
              {
                label: `Design prompt · slide ${slide.index}`,
                text: withBrandKit(slide.design_prompt),
              },
            ]
          : [],
      );
    case "post":
    case "story":
    case "meme":
    case "poll":
      return item.body.design_prompt
        ? [
            {
              label: "Design prompt",
              text: withBrandKit(item.body.design_prompt),
            },
          ]
        : [];
    default:
      return [];
  }
}
