"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/schemas/action-result";
import { clearDeniedOfflineSession } from "@/lib/utils/offline";

/**
 * Shared submit/feedback handling for admin forms: pending state, inline
 * error and field messages, success toast and a server refresh.
 */
export function useAdminAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const router = useRouter();
  const toast = useToast();

  function clear() {
    setError("");
    setFields({});
  }

  function run<T>(
    execute: () => Promise<ActionResult<T>>,
    onSuccess: (data: T) => string | null,
  ) {
    if (!navigator.onLine) {
      setError("You're offline. This needs a connection. Nothing was changed.");
      return;
    }
    clear();
    startTransition(async () => {
      try {
        const result = await execute();
        if (!result.ok) {
          if (result.code === "UNAUTHENTICATED") {
            await clearDeniedOfflineSession(result.code);
            return;
          }
          setError(result.message);
          setFields(result.fields ?? {});
          // Re-runs the admin gate: a revoked or demoted admin leaves the panel.
          if (result.code === "FORBIDDEN" || result.saved) router.refresh();
          return;
        }
        const message = onSuccess(result.data);
        if (message) toast.show({ message });
        router.refresh();
      } catch {
        console.error("Admin action transport failed.");
        setError("Couldn't confirm the save. Reload before trying again.");
      }
    });
  }

  return { pending, error, fields, run, clear };
}
