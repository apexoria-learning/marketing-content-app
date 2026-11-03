"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cx } from "@/lib/utils/cx";

export const ADMIN_SECTIONS = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "users", label: "Users", href: "/admin/users" },
  { key: "platforms", label: "Platforms", href: "/admin/platforms" },
  { key: "prompts", label: "Prompts", href: "/admin/prompts" },
  { key: "filters", label: "Filters", href: "/admin/filters" },
  { key: "settings", label: "Settings", href: "/admin/settings" },
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number]["key"];

// One swipeable row with a hidden scrollbar. Links keep their natural width
// (shrinking them let the global overflow-wrap break every letter), and the
// active link is scrolled into view because it may start off-screen.
export function AdminSectionNav({ active }: { active: AdminSection }) {
  const activeLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeLink.current?.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
  }, [active]);

  return (
    <nav
      aria-label="Admin sections"
      className="scrollbar-hidden -mx-1 mb-8 overflow-x-auto"
    >
      <ul className="flex w-max gap-2 px-1 py-1">
        {ADMIN_SECTIONS.map((section) => (
          <li key={section.key} className="shrink-0">
            <Link
              ref={section.key === active ? activeLink : undefined}
              href={section.href}
              aria-current={section.key === active ? "page" : undefined}
              className={cx(
                "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium whitespace-nowrap",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                section.key === active
                  ? "border-border-strong bg-accent-muted text-primary"
                  : "border-border bg-surface-2 text-secondary hover:text-primary",
              )}
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
