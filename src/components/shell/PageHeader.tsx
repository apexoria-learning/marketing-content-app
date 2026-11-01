"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { useShellScroll } from "./AppShell";
import { triggerHaptic } from "@/lib/utils/haptics";
import { refreshOfflinePage } from "@/lib/utils/offline";

export function PageHeader({
  title,
  back = false,
  actions,
  heading = true,
}: {
  title: string;
  back?: boolean;
  actions?: ReactNode;
  heading?: boolean;
}) {
  const { collapsed } = useShellScroll();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  return (
    <header
      className={cx(
        "page-header sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-3 py-2",
        collapsed && "border-b border-border bg-surface-1",
      )}
    >
      {back ? (
        <Button
          variant="icon"
          aria-label="Back"
          onClick={() =>
            window.history.length > 1 ? router.back() : router.push("/")
          }
        >
          <Icon name="chevron-left" />
        </Button>
      ) : null}
      {heading ? (
        <h1
          className={cx(
            "min-w-0 flex-1 font-display font-semibold text-primary",
            collapsed ? "text-h3" : "text-h1",
          )}
        >
          {title}
        </h1>
      ) : (
        <p className="min-w-0 flex-1 text-h3 font-semibold text-primary">
          {title}
        </p>
      )}
      {actions}
      <Button
        variant="icon"
        aria-label="Refresh this screen"
        loading={refreshing}
        onClick={() => {
          if (!navigator.onLine) {
            location.reload();
            return;
          }
          triggerHaptic("light");
          startRefresh(() => {
            router.refresh();
            refreshOfflinePage();
          });
        }}
      >
        <Icon name="refresh" />
      </Button>
    </header>
  );
}
