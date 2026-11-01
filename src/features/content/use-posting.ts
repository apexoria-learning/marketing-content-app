"use client";

import { useMemo, useOptimistic, useRef, useTransition } from "react";
import type { ContentPreview } from "@/lib/schemas/content";
import { useToast } from "@/components/ui/Toast";
import { triggerHaptic } from "@/lib/utils/haptics";
import { markPosted } from "@/server/actions";
import {
  clearDeniedOfflineSession,
  refreshOfflinePage,
} from "@/lib/utils/offline";

export function usePosting(items: ContentPreview[]) {
  const initial = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, item.status === "posted"]),
      ),
    [items],
  );
  const [statuses, setStatus] = useOptimistic(
    initial,
    (state, change: { id: string; posted: boolean }) => ({
      ...state,
      [change.id]: change.posted,
    }),
  );
  const [pending, startTransition] = useTransition();
  const latest = useRef(items);
  const inFlight = useRef(false);
  latest.current = items;
  const toast = useToast();
  function save(id: string, value: boolean) {
    if (inFlight.current) return;
    if (!navigator.onLine) {
      toast.show({
        tone: "error",
        message: "You're offline. This needs a connection.",
      });
      return;
    }
    const item = latest.current.find((entry) => entry.id === id);
    if (!item) {
      toast.show({
        tone: "error",
        message:
          "This item is no longer in this view. Open Calendar to find it.",
      });
      return;
    }
    inFlight.current = true;
    startTransition(async () => {
      setStatus({ id, posted: value });
      try {
        const result = await markPosted({ item_id: id, posted: value });
        if (!result.ok) {
          setStatus({ id, posted: item.status === "posted" });
          if (await clearDeniedOfflineSession(result.code)) return;
          triggerHaptic("error");
          toast.show({
            tone: "error",
            message: result.message,
            action:
              result.saved || result.code === "VALIDATION"
                ? { label: "Reload", onAction: () => location.reload() }
                : result.code === "UNAUTHENTICATED" ||
                    result.code === "FORBIDDEN"
                  ? {
                      label: "Sign in",
                      onAction: () => location.assign("/sign-in"),
                    }
                  : { label: "Retry", onAction: () => save(id, value) },
          });
        } else {
          refreshOfflinePage(true);
          toast.show({
            message: value ? "Marked as posted." : "Returned to ready.",
            action: { label: "Undo", onAction: () => save(id, !value) },
          });
        }
      } catch {
        console.error("Status action transport failed.");
        setStatus({ id, posted: item.status === "posted" });
        toast.show({
          tone: "error",
          message: "Couldn't confirm the save. Reload before trying again.",
          action: { label: "Reload", onAction: () => location.reload() },
        });
      } finally {
        inFlight.current = false;
      }
    });
  }
  return { statuses, pending, save };
}
