"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Banner } from "@/components/feedback/Banner";
import { Button } from "@/components/ui/Button";
import { clearPrivateCache, refreshOfflinePage } from "@/lib/utils/offline";
import { useToast } from "@/components/ui/Toast";
import { signOut } from "@/server/auth/actions";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaControls() {
  const [offline, setOffline] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [iosInstall, setIosInstall] = useState(false);
  const toast = useToast();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    let disposed = false;
    navigator.serviceWorker.ready
      .then(() => {
        if (!disposed) refreshOfflinePage();
      })
      .catch(() => console.error("Offline worker did not become ready."));
    return () => {
      disposed = true;
    };
  }, [pathname, search]);

  useEffect(() => {
    const connectivity = () => setOffline(!navigator.onLine);
    const offerInstall = (event: Event) => {
      event.preventDefault();
      if (
        "prompt" in event &&
        typeof event.prompt === "function" &&
        "userChoice" in event
      )
        setInstall(event as InstallEvent);
    };
    const installed = () => setInstall(null);
    const navigateOffline = (event: MouseEvent) => {
      if (
        navigator.onLine ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target ||
        link.origin !== location.origin ||
        link.hash
      )
        return;
      event.preventDefault();
      location.assign(link.href);
    };
    connectivity();
    if (
      /iP(hone|ad|od)/.test(navigator.userAgent) &&
      !window.matchMedia("(display-mode: standalone)").matches &&
      !("standalone" in navigator && navigator.standalone === true)
    )
      setIosInstall(true);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    window.addEventListener("beforeinstallprompt", offerInstall);
    window.addEventListener("appinstalled", installed);
    document.addEventListener("click", navigateOffline, true);
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let offered: ServiceWorker | null = null;
    let disposed = false;
    // Another tab may activate (or a newer build may replace) the offered
    // worker; then "Update" would post to a worker that never takes control.
    const offeredChanged = () => {
      if (offered?.state === "activated" || offered?.state === "redundant") {
        offered.removeEventListener("statechange", offeredChanged);
        offered = null;
        if (!disposed) setWaiting(null);
      }
    };
    const stateChanged = () => {
      const next = registration?.waiting ?? null;
      if (
        disposed ||
        !next ||
        !navigator.serviceWorker.controller ||
        next === offered
      )
        return;
      offered?.removeEventListener("statechange", offeredChanged);
      offered = next;
      offered.addEventListener("statechange", offeredChanged);
      setWaiting(next);
    };
    const updateFound = () => {
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", stateChanged);
    };
    if ("serviceWorker" in navigator) {
      const ready =
        process.env.NODE_ENV === "production"
          ? navigator.serviceWorker.ready
          : navigator.serviceWorker.getRegistration();
      ready
        .then((value) => {
          if (disposed) return;
          registration = value;
          stateChanged();
          registration?.addEventListener("updatefound", updateFound);
        })
        .catch(() => {
          console.error("PWA registration could not be inspected.");
          toast.show({
            tone: "error",
            message: "Offline support could not start. Reload to try again.",
          });
        });
    }
    return () => {
      disposed = true;
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      window.removeEventListener("beforeinstallprompt", offerInstall);
      window.removeEventListener("appinstalled", installed);
      document.removeEventListener("click", navigateOffline, true);
      registration?.removeEventListener("updatefound", updateFound);
      installing?.removeEventListener("statechange", stateChanged);
      offered?.removeEventListener("statechange", offeredChanged);
    };
  }, [toast]);

  return (
    <div className="space-y-3">
      {offline ? (
        <Banner>
          You&apos;re offline. Previously loaded pages are available; changes
          need a connection.
        </Banner>
      ) : null}
      {iosInstall ? (
        <Banner variant="accent" onDismiss={() => setIosInstall(false)}>
          On iPhone or iPad, open Share and choose Add to Home Screen to install
          Apexoria.
        </Banner>
      ) : null}
      {waiting ? (
        <Banner
          variant="accent"
          action={{
            label: "Update",
            onAction: () => {
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => location.reload(),
                { once: true },
              );
              waiting.postMessage({ type: "SKIP_WAITING" });
            },
          }}
        >
          An app update is ready.
        </Banner>
      ) : null}
      {install ? (
        <Banner
          variant="accent"
          action={{
            label: "Install",
            onAction: () => {
              install
                .prompt()
                .then(() => install.userChoice)
                .then(() => setInstall(null))
                .catch(() => {
                  console.error("PWA installation failed.");
                  toast.show({
                    tone: "error",
                    message: "Installation didn't complete. Try again.",
                  });
                });
            },
          }}
          onDismiss={() => setInstall(null)}
        >
          Install Apexoria for quick access.
        </Banner>
      ) : null}
    </div>
  );
}

export function SignOutControl() {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={async () => {
        if (!navigator.onLine) {
          toast.show({
            tone: "error",
            message: "You're offline. Signing out needs a connection.",
          });
          return;
        }
        setPending(true);
        try {
          await clearPrivateCache();
        } catch {
          console.error("Private offline cache could not be cleared.");
          toast.show({
            tone: "error",
            message:
              "Offline data could not be cleared. Reload before signing out.",
          });
          setPending(false);
          return;
        }
        await signOut();
      }}
    >
      Sign out
    </Button>
  );
}
