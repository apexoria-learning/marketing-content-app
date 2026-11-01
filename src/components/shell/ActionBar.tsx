"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import { useShellScroll } from "./AppShell";

export function ActionBar({ children }: { children: ReactNode }) {
  const { hideActions } = useShellScroll();
  return (
    <div
      className={cx(
        "action-bar e3 fixed z-30 flex items-center justify-center gap-3 rounded-pill p-2 transition-opacity duration-(--motion-fast)",
        hideActions && "pointer-events-none opacity-0",
      )}
      inert={hideActions || undefined}
    >
      {children}
    </div>
  );
}
