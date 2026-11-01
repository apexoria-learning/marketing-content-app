"use client";

import { useMemo } from "react";
import type { ContentPreview } from "@/lib/schemas/content";
import { StatusTick } from "@/components/ui/StatusTick";
import { usePosting } from "./use-posting";

export function TrackedTick({ item }: { item: ContentPreview }) {
  const items = useMemo(() => [item], [item]);
  const { statuses, pending, save } = usePosting(items);
  return (
    <StatusTick
      checked={statuses[item.id] ?? false}
      hook={item.hook ?? item.idea}
      disabled={pending || !["ready", "posted"].includes(item.status)}
      onCheckedChange={(value) => save(item.id, value)}
    />
  );
}
