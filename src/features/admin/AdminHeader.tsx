import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { cx } from "@/lib/utils/cx";

export const ADMIN_SECTIONS = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "users", label: "Users", href: "/admin/users" },
  { key: "prompts", label: "Prompts", href: "/admin/prompts" },
  { key: "filters", label: "Filters", href: "/admin/filters" },
  { key: "settings", label: "Settings", href: "/admin/settings" },
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number]["key"];

export function AdminHeader({ active }: { active: AdminSection }) {
  return (
    <>
      <PageHeader back title="Admin" />
      <nav aria-label="Admin sections" className="-mx-1 mb-8 overflow-x-auto">
        <ul className="flex gap-2 px-1 py-1">
          {ADMIN_SECTIONS.map((section) => (
            <li key={section.key}>
              <Link
                href={section.href}
                aria-current={section.key === active ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 text-sm font-medium",
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
