"use client";

import { useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ChangeEvent } from "react";
import { EASE_STANDARD } from "@/lib/constants/motion";
import { cx } from "@/lib/utils/cx";
import { triggerHaptic } from "@/lib/utils/haptics";

type StatusTickProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The item's hook, used in the accessible label. */
  hook: string;
  disabled?: boolean;
  className?: string;
};

// The posted checkbox (DESIGN.md §6.4). A real <input type="checkbox"> covers
// the full 44×44 target; the 28px square is purely visual. The tick draws
// (and on rollback un-draws) over `base` via stroke-dashoffset; reduced motion
// makes it appear instantly.
export function StatusTick({
  checked,
  onCheckedChange,
  hook,
  disabled,
  className,
}: StatusTickProps) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const reducedMotion = useReducedMotion();
  const previous = useRef(checked);

  useEffect(() => {
    if (previous.current === checked) {
      return;
    }

    previous.current = checked;

    if (checked && !reducedMotion && scope.current) {
      animate(
        scope.current,
        { scale: [0.9, 1.06, 1] },
        { duration: 0.4, ease: EASE_STANDARD },
      );
    }
  }, [checked, reducedMotion, animate, scope]);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.checked;

    if (next) {
      triggerHaptic("light");
    }

    onCheckedChange(next);
  }

  return (
    <label
      className={cx(
        "relative inline-flex size-11 shrink-0 items-center justify-center",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={`Mark ${hook} as posted`}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-sm opacity-0 disabled:cursor-default"
      />
      <span
        ref={scope}
        aria-hidden="true"
        className={cx(
          "pointer-events-none flex size-7 items-center justify-center rounded-sm border-2",
          "transition-colors duration-(--motion-base) ease-standard",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          "peer-disabled:opacity-40",
          checked
            ? "border-accent bg-accent text-accent-on"
            : "border-border-strong bg-transparent text-transparent",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5"
          focusable="false"
        >
          <path
            d="M5 12.5 10 17l9-10"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={checked ? 0 : 1}
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-[stroke-dashoffset] duration-(--motion-base) ease-standard motion-reduce:transition-none"
          />
        </svg>
      </span>
    </label>
  );
}
