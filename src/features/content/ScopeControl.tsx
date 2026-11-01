"use client";

import { useEffect } from "react";
import {
  navigateReadPage,
  restoreReadFocus,
} from "@/lib/utils/read-navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { ReadParams } from "@/lib/schemas/read-params";
export function ScopeControl({
  params,
  mode,
}: {
  params: ReadParams;
  mode: "archive" | "create";
}) {
  useEffect(() => restoreReadFocus(), []);
  const segments =
    mode === "archive"
      ? [
          { value: "this_month", label: "This month" },
          { value: "last_month", label: "Last month" },
          { value: "all", label: "All" },
        ]
      : [
          { value: "", label: "All" },
          { value: "carousel", label: "Carousel" },
          { value: "reel", label: "Reel" },
          { value: "post", label: "Post" },
        ];
  // Other formats retain an explicit native filter rather than falsely selecting "All".
  if (
    mode === "create" &&
    params.format &&
    !["carousel", "reel", "post"].includes(params.format)
  )
    return null;
  return (
    <div id={`${mode}-scope-control`}>
      <SegmentedControl
        label={mode === "archive" ? "Archive scope" : "Format scope"}
        value={mode === "archive" ? params.scope : (params.format ?? "")}
        segments={segments}
        onChange={(value) => {
          const search = new URLSearchParams();
          if (params.platform) search.set("platform", params.platform);
          if (mode === "archive") {
            if (params.pillar) search.set("pillar", params.pillar);
            if (params.format) search.set("format", params.format);
            search.set("scope", value);
          } else if (value) search.set("format", value);
          navigateReadPage(
            `/${mode}`,
            search,
            mode === "archive"
              ? "archive-scope-control"
              : "create-scope-control",
          );
        }}
      />
    </div>
  );
}
