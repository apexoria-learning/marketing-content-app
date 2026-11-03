"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/feedback/States";
import { FORMAT_LABELS } from "@/components/content/FormatChip";
import { PLATFORM_SLOT_CLASSES } from "@/components/content/PlatformBadge";
import { toPlatformIcon, type PlatformRecord } from "@/lib/schemas/platforms";
import { cx } from "@/lib/utils/cx";
import { reorderPlatform } from "@/server/actions/admin";
import { PlatformForm } from "./PlatformForm";
import { useAdminAction } from "./use-admin-action";

function hashtagRule(platform: PlatformRecord) {
  return platform.allows_hashtags
    ? `Up to ${platform.max_hashtags} hashtags`
    : "No hashtags";
}

export function PlatformManager({
  platforms,
}: {
  platforms: PlatformRecord[];
}) {
  const [editing, setEditing] = useState<PlatformRecord | "new" | null>(null);
  const { pending, error, run } = useAdminAction();

  function move(platform: PlatformRecord, direction: "up" | "down") {
    run(
      () => reorderPlatform({ key: platform.key, direction }),
      () => null,
    );
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => setEditing("new")}>
        <Icon name="plus" size="chip" />
        Add platform
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {platforms.length === 0 ? (
        <EmptyState
          glyph="layers"
          statement="No platforms yet."
          guidance="Add the first platform your team posts to."
        />
      ) : (
        <ol className="space-y-3" aria-label="Platforms in display order">
          {platforms.map((platform, index) => (
            <li
              key={platform.key}
              className={cx(
                "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-1 p-4",
                !platform.is_enabled && "opacity-75",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-pill",
                  PLATFORM_SLOT_CLASSES[platform.colour_slot],
                )}
              >
                <Icon name={toPlatformIcon(platform.icon)} />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-primary">
                  {platform.label}
                  {platform.is_enabled ? "" : " · Retired"}
                </p>
                <p className="text-caption text-secondary">
                  {platform.formats
                    .map((format) => FORMAT_LABELS[format])
                    .join(", ")}{" "}
                  · {hashtagRule(platform)}
                  {platform.caption_max_chars
                    ? ` · Caption ≤ ${platform.caption_max_chars}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="icon"
                  aria-label={`Move ${platform.label} up`}
                  disabled={pending || index === 0}
                  onClick={() => move(platform, "up")}
                >
                  <Icon name="chevron-left" className="rotate-90" />
                </Button>
                <Button
                  variant="icon"
                  aria-label={`Move ${platform.label} down`}
                  disabled={pending || index === platforms.length - 1}
                  onClick={() => move(platform, "down")}
                >
                  <Icon name="chevron-right" className="rotate-90" />
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setEditing(platform)}
                >
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <BottomSheet
        open={editing !== null}
        title={
          editing === "new" || editing === null
            ? "Add a platform"
            : `Edit ${editing.label}`
        }
        onClose={() => setEditing(null)}
      >
        {editing !== null ? (
          <PlatformForm
            key={editing === "new" ? "new" : editing.key}
            existing={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}
