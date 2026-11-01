"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DURATION,
  EASE_STANDARD,
  TOAST_DURATION_MS,
} from "@/lib/constants/motion";
import { cx } from "@/lib/utils/cx";
import { Button } from "./Button";
import { Icon } from "./Icon";

export type ToastOptions = {
  message: string;
  tone?: "neutral" | "error";
  action?: { label: string; onAction: () => void };
};

type ActiveToast = ToastOptions & { id: number };

type ToastApi = { show: (toast: ToastOptions) => void; dismiss: () => void };

const ToastContext = createContext<ToastApi | null>(null);
const SWIPE_DISMISS_OFFSET = 80;

export function useToast(): ToastApi {
  const api = useContext(ToastContext);

  if (!api) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }

  return api;
}

// One toast at a time; a new toast replaces the current one (DESIGN.md §6.4).
// Both live regions are mounted up front so screen readers register them
// before content arrives: polite for status, assertive for errors (§12).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(dismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const isError = toast?.tone === "error";

  function onDragEnd(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > SWIPE_DISMISS_OFFSET) {
      dismiss();
    }
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-50 flex justify-center px-5">
        <div role="status" aria-live="polite" className="contents">
          {toast && !isError ? (
            <ToastView
              toast={toast}
              onDismiss={dismiss}
              onDragEnd={onDragEnd}
            />
          ) : null}
        </div>
        <div role="alert" aria-live="assertive" className="contents">
          {toast && isError ? (
            <ToastView
              toast={toast}
              onDismiss={dismiss}
              onDragEnd={onDragEnd}
            />
          ) : null}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onDismiss,
  onDragEnd,
}: {
  toast: ActiveToast;
  onDismiss: () => void;
  onDragEnd: (event: unknown, info: PanInfo) => void;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={toast.id}
        drag="x"
        dragSnapToOrigin
        onDragEnd={onDragEnd}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.fast, ease: EASE_STANDARD }}
        className="e4 pointer-events-auto flex w-full max-w-(--container-content) items-center gap-3 rounded-lg py-2 pr-2 pl-4"
      >
        {toast.tone === "error" ? (
          <Icon name="alert" className="text-danger" />
        ) : null}
        <p className={cx("line-clamp-2 flex-1 text-sm text-primary")}>
          {toast.message}
        </p>
        {toast.action ? (
          <Button
            variant="ghost"
            className="text-primary!"
            onClick={() => {
              toast.action?.onAction();
              onDismiss();
            }}
          >
            {toast.action.label}
          </Button>
        ) : null}
        <Button variant="icon" aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="close" size="chip" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
