import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
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

export function AdminHeader({ active }: { active: AdminSection }) {
  return (
    <>
      <PageHeader back title="Admin" />
      <nav aria-label="Admin sections" className="mb-8">
        {/* Links keep their natural width and wrap onto a second row, so the
            active section is always visible; shrinking them let the global
            overflow-wrap break every letter. */}
        <ul className="flex flex-wrap gap-2">
          {ADMIN_SECTIONS.map((section) => (
            <li key={section.key} className="shrink-0">
              <Link
                href={section.href}
                aria-current={section.key === active ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 text-sm font-medium whitespace-nowrap",
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
    </>
  );
}
