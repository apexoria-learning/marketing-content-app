"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cx } from "@/lib/utils/cx";

export type Segment<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  label: string;
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

const MAX_SEGMENTS = 4;

// Static class maps: inline style attributes would be blocked by the CSP.
const GRID_COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
} as const;
const THUMB_WIDTH = {
  2: "w-[calc((100%-0.5rem)/2)]",
  3: "w-[calc((100%-0.5rem)/3)]",
  4: "w-[calc((100%-0.5rem)/4)]",
} as const;
const THUMB_OFFSET = [
  "translate-x-0",
  "translate-x-full",
  "translate-x-[200%]",
  "translate-x-[300%]",
] as const;

// Single-select radiogroup with a sliding thumb (DESIGN.md §6.4). The thumb
// moves with transform only, so reduced motion keeps it a plain state change.
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  if (segments.length < 2 || segments.length > MAX_SEGMENTS) {
    throw new Error(`SegmentedControl takes 2–${MAX_SEGMENTS} segments.`);
  }

  const count = segments.length as 2 | 3 | 4;
  const selectedIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.value === value),
  );

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];

    if (step === undefined) {
      return;
    }

    event.preventDefault();
    const next = (selectedIndex + step + segments.length) % segments.length;
    const segment = segments[next];

    if (segment) {
      onChange(segment.value);
      refs.current[next]?.focus();
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "relative grid rounded-pill bg-surface-2 p-1",
        GRID_COLUMNS[count],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-y-1 left-1 rounded-pill border border-border bg-surface-1 transition-transform duration-(--motion-base) ease-standard motion-reduce:transition-none",
          THUMB_WIDTH[count],
          THUMB_OFFSET[selectedIndex],
        )}
      />
      {segments.map((segment, index) => {
        const checked = index === selectedIndex;

        return (
          <button
            key={segment.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            name={name}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(segment.value)}
            onKeyDown={onKeyDown}
            className={cx(
              "relative min-h-11 rounded-pill px-3 text-sm font-semibold transition-colors duration-(--motion-fast)",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              checked ? "text-primary" : "text-secondary hover:text-primary",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
