"use client";

import { useAnimate, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { DURATION, EASE_STANDARD } from "@/lib/constants/motion";
import { BottomNav } from "./BottomNav";
import { triggerHaptic } from "@/lib/utils/haptics";
import { refreshOfflinePage } from "@/lib/utils/offline";

const ScrollContext = createContext({ collapsed: false, hideActions: false });
export function useShellScroll() {
  return useContext(ScrollContext);
}

export function AppShell({
  children,
  prompts,
}: {
  children: ReactNode;
  prompts: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const previousPath = useRef(pathname);
  const positions = useRef(new Map<string, number>());
  const lastScroll = useRef(0);
  const [scroll, setScroll] = useState({
    collapsed: false,
    hideActions: false,
  });
  const [scope, animate] = useAnimate<HTMLElement>();
  const reducedMotion = useReducedMotion();
  const [refreshing, startRefresh] = useTransition();
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      positions.current.set(previousPath.current, y);
      setScroll({
        collapsed: y > 8,
        hideActions: y > 24 && y > lastScroll.current,
      });
      lastScroll.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    const isDetail = pathname.startsWith("/item/");
    const isBack = previousPath.current.startsWith("/item/") && !isDetail;
    previousPath.current = pathname;
    window.scrollTo({
      top: positions.current.get(pathname) ?? 0,
      behavior: "instant",
    });
    if (scope.current) {
      animate(
        scope.current,
        {
          opacity: [0, 1],
          y:
            reducedMotion || (!isDetail && !isBack)
              ? [0, 0]
              : [isBack ? -16 : 16, 0],
        },
        {
          duration: isDetail || isBack ? DURATION.base : DURATION.fast,
          ease: EASE_STANDARD,
        },
      );
    }
  }, [pathname, scope, animate, reducedMotion]);

  useEffect(() => {
    const visibility = () => {
      try {
        if (document.hidden)
          sessionStorage.setItem("apexoria-backgrounded", String(Date.now()));
        else {
          const backgrounded = Number(
            sessionStorage.getItem("apexoria-backgrounded"),
          );
          sessionStorage.removeItem("apexoria-backgrounded");
          if (backgrounded > 0 && Date.now() - backgrounded > 4 * 60 * 60_000)
            router.replace("/");
        }
      } catch {
        console.warn("App resume position could not be stored.");
      }
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [router]);

  return (
    <ScrollContext.Provider value={scroll}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-5 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:p-3 focus:text-accent-on"
      >
        Skip to content
      </a>
      <main
        id="main-content"
        ref={scope}
        className="app-content mx-auto min-h-dvh w-full max-w-content px-page"
        onTouchStart={(event) => {
          const point = event.touches[0];
          const interactive =
            event.target instanceof Element &&
            event.target.closest("dialog,button,a,input,textarea,select");
          touch.current =
            !interactive && window.scrollY === 0 && point
              ? { x: point.clientX, y: point.clientY }
              : null;
        }}
        onTouchEnd={(event) => {
          const point = event.changedTouches[0];
          const start = touch.current;
          touch.current = null;
          if (
            !point ||
            !start ||
            refreshing ||
            point.clientY - start.y < 64 ||
            Math.abs(point.clientX - start.x) > 40 ||
            !window.getSelection()?.isCollapsed
          )
            return;
          triggerHaptic("light");
          if (!navigator.onLine) location.reload();
          else
            startRefresh(() => {
              router.refresh();
              refreshOfflinePage();
            });
        }}
      >
        {prompts}
        {refreshing ? (
          <div role="status" className="flex justify-center py-3">
            <svg
              viewBox="0 0 56 56"
              className="size-14 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            >
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                strokeWidth="4"
                strokeDasharray="100 50"
                className="stroke-accent"
              />
            </svg>
            <span className="sr-only">Refreshing content</span>
          </div>
        ) : null}
        {children}
      </main>
      <BottomNav />
    </ScrollContext.Provider>
  );
}
