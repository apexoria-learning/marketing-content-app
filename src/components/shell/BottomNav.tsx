"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../ui/Icon";
import { cx } from "@/lib/utils/cx";

const destinations: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/create", label: "Create", icon: "create" },
  { href: "/archive", label: "Archive", icon: "archive" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main navigation"
      className="bottom-nav e3 fixed z-30 grid grid-cols-4 gap-1 rounded-pill px-2"
    >
      {destinations.map(({ href, label, icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            scroll={false}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-pill text-eyebrow font-semibold focus-visible:outline-2 focus-visible:outline-accent",
              active ? "text-primary" : "text-secondary",
            )}
          >
            <Icon
              name={icon}
              size="nav"
              className={active ? "text-accent" : undefined}
            />
            <span className="break-all text-center">{label}</span>
            <span
              aria-hidden="true"
              className={cx(
                "size-1 rounded-pill bg-accent",
                !active && "invisible",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
