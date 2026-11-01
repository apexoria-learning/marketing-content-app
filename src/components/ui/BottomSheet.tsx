"use client";

import {
  motion,
  useAnimate,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { DURATION, EASE_STANDARD } from "@/lib/constants/motion";
import { cx } from "@/lib/utils/cx";
import { triggerHaptic } from "@/lib/utils/haptics";
import { Button } from "./Button";
import { Icon } from "./Icon";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
};

const DISMISS_OFFSET = 96;
const DISMISS_VELOCITY = 500;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The only overlay pattern in the product (DESIGN.md §6.1). Built on a modal
// <dialog> so the page behind is inert; focus is trapped, Escape closes, and
// focus returns to the trigger. Drag-to-dismiss from the handle has a close
// button as its non-gesture equivalent (§12).
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  const [scope, animate] = useAnimate<HTMLDialogElement>();
  const dragControls = useDragControls();
  const reducedMotion = useReducedMotion();
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = scope.current;

    if (!dialog) {
      return;
    }

    const hidden = reducedMotion ? { opacity: 0 } : { y: "100%" };
    const shown = reducedMotion ? { opacity: 1 } : { y: 0 };
    const transition = {
      duration: reducedMotion ? DURATION.fast : DURATION.slow,
      ease: EASE_STANDARD,
    };

    if (open && !dialog.open) {
      trigger.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      animate(dialog, hidden, { duration: 0 });
      animate(dialog, shown, transition);
    } else if (!open && dialog.open) {
      animate(dialog, hidden, transition).then(() => {
        dialog.close();
        animate(dialog, { y: 0, opacity: 1 }, { duration: 0 });
        trigger.current?.focus();
      });
    }
  }, [open, reducedMotion, animate, scope]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDialogElement>) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        scope.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );

      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [scope],
  );

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      triggerHaptic("medium");
      onClose();
    } else {
      animate(
        scope.current,
        { y: 0 },
        { duration: DURATION.base, ease: EASE_STANDARD },
      );
    }
  }

  return (
    <motion.dialog
      ref={scope}
      aria-labelledby={titleId}
      drag={reducedMotion ? false : "y"}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 1 }}
      onDragEnd={onDragEnd}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Only the ::backdrop resolves to the dialog itself.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={onKeyDown}
      className={cx(
        "e4 fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-(--container-content) max-h-[85vh] rounded-t-xl p-0 text-primary",
        "backdrop:bg-scrim backdrop:backdrop-blur-xs",
        className,
      )}
    >
      <div className="flex max-h-[85vh] flex-col">
        <div
          aria-hidden="true"
          className="flex min-h-6 cursor-grab touch-none justify-center pt-3 active:cursor-grabbing"
          onPointerDown={(event) => dragControls.start(event)}
        >
          <span className="h-1 w-10 rounded-pill bg-border-strong" />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 pb-2">
          <h2 id={titleId} className="text-h3 font-semibold">
            {title}
          </h2>
          <Button variant="icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </Button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {children}
        </div>
      </div>
    </motion.dialog>
  );
}
