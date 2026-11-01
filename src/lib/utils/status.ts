import type { ContentStatus } from "../schemas/content";

export function canChangeStatus(from: ContentStatus, to: ContentStatus) {
  const transitions: Record<ContentStatus, ContentStatus[]> = {
    idea: ["ready", "skipped"],
    ready: ["posted", "skipped"],
    posted: ["ready"],
    skipped: ["ready"],
  };
  return from === to || transitions[from].includes(to);
}
