"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import {
  hydrateItem,
  regenerateItem,
  planMonth,
  generateForDay,
} from "@/server/actions";
import {
  clearDeniedOfflineSession,
  refreshOfflinePage,
} from "@/lib/utils/offline";
import { displayTimestamp } from "@/lib/utils/dates";

type GenerationTarget =
  | { kind: "hydrate" | "regenerate"; itemId: string }
  | { kind: "month"; month: string }
  | { kind: "day"; date: string };

export function GenerationControl({
  target,
  enabled,
  auto = false,
}: {
  target: GenerationTarget;
  enabled: boolean;
  auto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [steer, setSteer] = useState("");
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState("");
  const [updated, setUpdated] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const [stage, setStage] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const autoStarted = useRef(false);
  const stages = ["Researching…", "Writing…", "Briefing…"];
  useEffect(() => {
    if (!pending) {
      setStage(0);
      return;
    }
    const timer = setInterval(
      () => setStage((value) => Math.min(2, value + 1)),
      5000,
    );
    return () => clearInterval(timer);
  }, [pending]);

  const execute = useCallback(() => {
    if (pending || requiresReload || !enabled) return;
    if (!navigator.onLine) {
      setError("You're offline. Generation needs a connection.");
      return;
    }
    setError("");
    setUpdated(false);
    startTransition(async () => {
      try {
        const result =
          target.kind === "month"
            ? await planMonth({ month: target.month })
            : target.kind === "day"
              ? await generateForDay({ date: target.date, count: 1 })
              : target.kind === "hydrate"
                ? await hydrateItem({ item_id: target.itemId })
                : await regenerateItem({ item_id: target.itemId, steer });
        if (!result.ok) {
          if (await clearDeniedOfflineSession(result.code)) return;
          if (result.code === "RATE_LIMITED")
            setRetryAfter(result.retry_after ?? "");
          setError(result.message);
          if (result.saved) {
            setRequiresReload(true);
            setError(`${result.message} Reload before retrying.`);
          }
          return;
        }
        setOpen(false);
        setUpdated(true);
        const omission =
          "news_omitted" in result.data && result.data.news_omitted;
        toast.show({
          message: omission
            ? "Month planned. News was omitted because sources are unavailable."
            : "Content updated.",
        });
        refreshOfflinePage(true);
        router.refresh();
      } catch {
        console.error("Generation action transport failed.");
        setRequiresReload(true);
        setError("Couldn't confirm generation. Reload before trying again.");
      }
    });
  }, [pending, requiresReload, enabled, target, steer, toast, router]);
  // Automatic hydration uses the same authorized action and budget as the button.
  useEffect(() => {
    if (!auto || !enabled || target.kind !== "hydrate" || autoStarted.current)
      return;
    autoStarted.current = true;
    execute();
  }, [auto, enabled, target.kind, execute]);

  const label =
    target.kind === "month"
      ? "Plan this month"
      : target.kind === "day"
        ? "Generate for this day"
        : target.kind === "hydrate"
          ? "Generate content"
          : "Regenerate";
  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        disabled={!enabled || requiresReload}
        loading={pending}
        onClick={() =>
          target.kind === "regenerate" ? setOpen(true) : execute()
        }
      >
        {label}
      </Button>
      {pending ? (
        <p role="status" className="text-sm text-secondary">
          {stages[stage]} You can keep using the app.
        </p>
      ) : null}
      {updated ? (
        <p role="status" className="text-sm text-success">
          Updated
        </p>
      ) : null}
      {!enabled ? (
        <p className="text-sm text-secondary">
          Generation will be available after setup is complete.
        </p>
      ) : null}
      {error && !retryAfter && !open ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <BottomSheet
        open={open}
        title="Regenerate content"
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            execute();
          }}
        >
          <label
            htmlFor="generation-steer"
            className="block text-sm font-medium"
          >
            What should change? (optional)
          </label>
          <textarea
            id="generation-steer"
            value={steer}
            onChange={(event) => setSteer(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={pending}
            className="w-full rounded-md border border-border-strong bg-surface-sunken p-3 text-body text-primary"
          />
          <div className="flex flex-wrap gap-2">
            {[
              "Make it simpler",
              "Use a practical example",
              "Make it more concise",
            ].map((example) => (
              <Button
                key={example}
                variant="ghost"
                type="button"
                onClick={() => setSteer(example)}
                disabled={pending}
              >
                {example}
              </Button>
            ))}
          </div>
          {error && !retryAfter ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={!enabled || requiresReload}
            loading={pending}
          >
            Regenerate
          </Button>
        </form>
      </BottomSheet>
      <BottomSheet
        open={Boolean(retryAfter)}
        title="Today's generation allowance is used"
        onClose={() => setRetryAfter("")}
      >
        <p className="text-body text-secondary">{error}</p>
        {retryAfter ? (
          <p className="mt-3 text-sm text-secondary">
            Resets {displayTimestamp(retryAfter)} IST.
          </p>
        ) : null}
      </BottomSheet>
    </div>
  );
}
