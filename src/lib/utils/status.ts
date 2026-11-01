import type { ContentItem, ContentStatus } from "../schemas/content";

export function hasHydratedContent(
  item: Pick<
    ContentItem,
    "body" | "design_brief" | "hydrated_at" | "hook" | "caption"
  >,
) {
  return Boolean(
    item.body &&
    item.design_brief &&
    item.hydrated_at &&
    item.hook?.trim() &&
    item.caption?.trim(),
  );
}

export function canChangeStatus(from: ContentStatus, to: ContentStatus) {
  const transitions: Record<ContentStatus, ContentStatus[]> = {
    idea: ["ready", "skipped"],
    ready: ["posted", "skipped"],
    posted: ["ready"],
    skipped: ["ready"],
  };
  return from === to || transitions[from].includes(to);
}
