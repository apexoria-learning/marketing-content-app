export type HapticKind = "light" | "medium" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  error: [30, 40, 30],
};

type HapticEnvironment = {
  vibrate?: (pattern: number | number[]) => boolean;
  reducedMotion: boolean;
};

function currentEnvironment(): HapticEnvironment {
  if (typeof window === "undefined") {
    return { reducedMotion: true };
  }

  return {
    vibrate:
      typeof navigator.vibrate === "function"
        ? navigator.vibrate.bind(navigator)
        : undefined,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
  };
}

/**
 * Feature-detected haptics; silently skipped where unsupported and disabled
 * entirely under prefers-reduced-motion (DESIGN.md §10.4).
 */
export function triggerHaptic(
  kind: HapticKind,
  environment: HapticEnvironment = currentEnvironment(),
): boolean {
  if (environment.reducedMotion || !environment.vibrate) {
    return false;
  }

  try {
    return environment.vibrate(PATTERNS[kind]);
  } catch {
    return false;
  }
}
