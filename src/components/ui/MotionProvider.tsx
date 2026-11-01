"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, EASE_STANDARD } from "@/lib/constants/motion";

/**
 * Global reduced-motion switch (DESIGN.md §10.5). With `reducedMotion="user"`
 * Motion drops transform animations and keeps opacity, so every transition
 * degrades to a cross-fade with no functionality lost.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: DURATION.base, ease: EASE_STANDARD }}
    >
      {children}
    </MotionConfig>
  );
}
