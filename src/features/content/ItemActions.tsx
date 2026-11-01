"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemControls } from "@/lib/schemas/content";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { AddNoteInputSchema, SkipItemInputSchema } from "@/lib/schemas/actions";
import { addNote, skipItem } from "@/server/actions";
import {
  clearDeniedOfflineSession,
  refreshOfflinePage,
} from "@/lib/utils/offline";

export function ItemActions({ item }: { item: ItemControls }) {
  const [sheet, setSheet] = useState<"note" | "skip" | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const hydrated = item.is_hydrated;
  const canSkip = item.status !== "posted" && hydrated;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setText("");
            setError("");
            setSheet("note");
          }}
        >
          Add note
        </Button>
        <Button
          variant="ghost"
          disabled={!canSkip}
          onClick={() => {
            setText("");
            setError("");
            setSheet("skip");
          }}
        >
          {item.status === "skipped" ? "Return to ready" : "Skip item"}
        </Button>
      </div>
      {item.status === "skipped" && !hydrated ? (
        <p className="mt-2 text-sm text-secondary">
          This skipped idea must be generated before it can return to ready. Use
          Generate content below to finish it first.
        </p>
      ) : null}
      {item.status === "idea" && !hydrated ? (
        <p className="mt-2 text-sm text-secondary">
          Generate this unfinished idea before skipping it. The idea remains in
          your Create queue.
        </p>
      ) : null}
      <BottomSheet
        open={sheet !== null}
        title={
          sheet === "note"
            ? "Add a note"
            : item.status === "skipped"
              ? "Return to ready"
              : "Skip this item"
        }
        onClose={() => {
          if (!pending) setSheet(null);
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const mode = sheet;
            if (!navigator.onLine) {
              setError("You're offline. This needs a connection.");
              return;
            }
            const parsed =
              mode === "note"
                ? AddNoteInputSchema.safeParse({ item_id: item.id, note: text })
                : SkipItemInputSchema.safeParse({
                    item_id: item.id,
                    skipped: item.status !== "skipped",
                    reason: text,
                  });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? "Check this field.");
              return;
            }
            startTransition(async () => {
              try {
                const result =
                  mode === "note"
                    ? await addNote({ item_id: item.id, note: text })
                    : await skipItem({
                        item_id: item.id,
                        skipped: item.status !== "skipped",
                        reason: text,
                      });
                if (!result.ok) {
                  if (await clearDeniedOfflineSession(result.code)) return;
                  setError(result.message);
                  return;
                }
                refreshOfflinePage(true);
                setSheet(null);
                setText("");
                toast.show({
                  message:
                    mode === "note"
                      ? "Note added to history."
                      : item.status === "skipped"
                        ? "Returned to ready."
                        : "Item skipped.",
                });
                router.refresh();
              } catch {
                console.error("Item action transport failed.");
                setError(
                  "Couldn't confirm the save. Reload before trying again.",
                );
              }
            });
          }}
          className="space-y-4"
        >
          <label
            className="block text-sm font-medium"
            htmlFor={`item-note-${item.id}`}
          >
            {sheet === "note" ? "Note" : "Reason (optional)"}
          </label>
          <textarea
            id={`item-note-${item.id}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={280}
            rows={3}
            disabled={pending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `note-error-${item.id}` : undefined}
            className="w-full rounded-md border border-border-strong bg-surface-sunken p-3 text-body text-primary"
          />
          {error ? (
            <p
              id={`note-error-${item.id}`}
              role="alert"
              className="text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
