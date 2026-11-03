"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/feedback/States";
import type { PillarRecord } from "@/lib/schemas/pillars";
import { cx } from "@/lib/utils/cx";
import { reorderPillar } from "@/server/actions/admin";
import { PillarForm } from "./PillarForm";
import { useAdminAction } from "./use-admin-action";

export function PillarManager({ pillars }: { pillars: PillarRecord[] }) {
  const [editing, setEditing] = useState<PillarRecord | "new" | null>(null);
  const { pending, error, run } = useAdminAction();

  function move(pillar: PillarRecord, direction: "up" | "down") {
    run(
      () => reorderPillar({ key: pillar.key, direction }),
      () => null,
    );
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => setEditing("new")}>
        <Icon name="plus" size="chip" />
        Add pillar
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {pillars.length === 0 ? (
        <EmptyState
          glyph="layers"
          statement="No pillars yet."
          guidance="Add the first theme your content rotates through."
        />
      ) : (
        <ol className="space-y-3" aria-label="Pillars in display order">
          {pillars.map((pillar, index) => (
            <li
              key={pillar.key}
              className={cx(
                "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-1 p-4",
                !pillar.is_enabled && "opacity-75",
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-primary">
                  {pillar.label}
                  {pillar.requires_news ? " · Needs news" : ""}
                  {pillar.is_enabled ? "" : " · Retired"}
                </p>
                <p className="text-caption text-secondary">
                  {pillar.description}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="icon"
                  aria-label={`Move ${pillar.label} up`}
                  disabled={pending || index === 0}
                  onClick={() => move(pillar, "up")}
                >
                  <Icon name="chevron-left" className="rotate-90" />
                </Button>
                <Button
                  variant="icon"
                  aria-label={`Move ${pillar.label} down`}
                  disabled={pending || index === pillars.length - 1}
                  onClick={() => move(pillar, "down")}
                >
                  <Icon name="chevron-right" className="rotate-90" />
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setEditing(pillar)}
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
            ? "Add a pillar"
            : `Edit ${editing.label}`
        }
        onClose={() => setEditing(null)}
      >
        {editing !== null ? (
          <PillarForm
            key={editing === "new" ? "new" : editing.key}
            existing={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}
