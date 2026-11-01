"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Banner } from "@/components/feedback/Banner";
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
import { DURATION, EASE_STANDARD } from "@/lib/constants/motion";

const UPDATED_VISIBLE_MS = 2000;

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
  // Month/day generation creates rows once; a second run would be a duplicate.
  const [completed, setCompleted] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const [stage, setStage] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const reducedMotion = useReducedMotion();
  const autoStarted = useRef(false);
  const steerId = useId();
  const stages = ["Researching…", "Writing…", "Briefing…"];
  const createsRows = target.kind === "month" || target.kind === "day";
  useEffect(() => {
    if (!updated) return;
    const timer = setTimeout(() => setUpdated(false), UPDATED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [updated]);
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
    if (pending || requiresReload || completed || !enabled) return;
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
        if (createsRows) setCompleted(true);
        const omission =
          "news_omitted" in result.data && result.data.news_omitted;
        toast.show({
          message:
            target.kind === "month"
              ? omission
                ? "Month planned. News was omitted because sources are unavailable."
                : "Month planned."
              : target.kind === "day"
                ? "Day planned."
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
  }, [
    pending,
    requiresReload,
    completed,
    createsRows,
    enabled,
    target,
    steer,
    toast,
    router,
  ]);
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
        disabled={!enabled || requiresReload || completed}
        loading={pending}
        onClick={() =>
          target.kind === "regenerate" ? setOpen(true) : execute()
        }
      >
        {completed
          ? target.kind === "month"
            ? "Month planned"
            : "Day planned"
          : label}
      </Button>
      {pending && target.kind === "month" ? (
        <Banner variant="accent" progress>
          Planning this month… You can keep using the app.
        </Banner>
      ) : pending ? (
        <p role="status" className="text-sm text-secondary">
          {stages[stage]} You can keep using the app.
        </p>
      ) : null}
      <AnimatePresence>
        {updated ? (
          <motion.p
            key="updated"
            role="status"
            className="text-eyebrow font-semibold tracking-eyebrow text-accent uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reducedMotion ? DURATION.fast : DURATION.base,
              ease: EASE_STANDARD,
            }}
          >
            Updated
          </motion.p>
        ) : null}
      </AnimatePresence>
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
          <label htmlFor={steerId} className="block text-sm font-medium">
            What should change? (optional)
          </label>
          <textarea
            id={steerId}
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
