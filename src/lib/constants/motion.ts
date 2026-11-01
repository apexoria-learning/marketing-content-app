// JS mirror of the motion tokens in styles/tokens.css (DESIGN.md §10.1).
// Motion expects seconds.
export const DURATION = {
  instant: 0.1,
  fast: 0.16,
  base: 0.24,
  slow: 0.32,
} as const;

export const EASE_STANDARD = [0.2, 0, 0, 1] as const;

// spring(1, 90, 14): mass, stiffness, damping.
export const SPRING = {
  type: "spring",
  mass: 1,
  stiffness: 90,
  damping: 14,
} as const;

export const TOAST_DURATION_MS = 4000;
export const COPY_CONFIRM_MS = 1500;
