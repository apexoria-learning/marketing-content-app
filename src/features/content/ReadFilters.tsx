import Link from "next/link";
import {
  PlatformSchema,
  PillarSchema,
  FormatSchema,
  StatusSchema,
} from "@/lib/schemas/content";
import type { ReadParams } from "@/lib/schemas/read-params";
import { PLATFORM_LABELS } from "@/components/content/PlatformBadge";
import { PILLAR_LABELS } from "@/components/content/PillarChip";
import { FORMAT_LABELS } from "@/components/content/FormatChip";
import { Button } from "@/components/ui/Button";

export function ReadFilters({
  path,
  params,
}: {
  path: "/calendar" | "/create" | "/archive";
  params: ReadParams;
}) {
  const selects = [
    {
      name: "platform",
      label: "Platform",
      values: PlatformSchema.options,
      labels: PLATFORM_LABELS,
    },
    ...(path === "/create"
      ? []
      : [
          {
            name: "pillar",
            label: "Pillar",
            values: PillarSchema.options,
            labels: PILLAR_LABELS,
          },
        ]),
    ...(path === "/calendar"
      ? [
          {
            name: "status",
            label: "Status",
            values: StatusSchema.options,
            labels: {
              idea: "Planned",
              ready: "Ready",
              posted: "Posted",
              skipped: "Skipped",
            },
          },
        ]
      : [
          {
            name: "format",
            label: "Format",
            values: FormatSchema.options,
            labels: FORMAT_LABELS,
          },
        ]),
  ];
  return (
    <details className="my-4 rounded-md border border-border bg-surface-sunken p-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
        Filters
        {[params.platform, params.pillar, params.format, params.status].filter(
          Boolean,
        ).length
          ? ` · ${[params.platform, params.pillar, params.format, params.status].filter(Boolean).length} active`
          : ""}
      </summary>
      <form
        action={path}
        data-read-focus={`${path.slice(1)}-filters-apply`}
        className="mt-3 space-y-3"
      >
        {path === "/calendar" ? (
          <input type="hidden" name="month" value={params.month} />
        ) : null}
        {path === "/archive" ? (
          <input type="hidden" name="scope" value={params.scope} />
        ) : null}
        {selects.map((select) => (
          <div key={select.name} className="text-sm text-secondary">
            <label htmlFor={`${path.slice(1)}-${select.name}`}>
              {select.label}
            </label>
            <select
              id={`${path.slice(1)}-${select.name}`}
              name={select.name}
              defaultValue={
                params[
                  select.name as "platform" | "pillar" | "format" | "status"
                ] ?? ""
              }
              className="mt-1 block min-h-11 w-full rounded-md border border-border-strong bg-surface-2 px-3 text-body text-primary"
            >
              <option value="">All</option>
              {select.values.map((value) => (
                <option key={value} value={value}>
                  {Object.entries(select.labels).find(
                    ([key]) => key === value,
                  )?.[1] ?? value}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="flex gap-3">
          <Button
            id={`${path.slice(1)}-filters-apply`}
            type="submit"
            variant="secondary"
          >
            Apply filters
          </Button>
          <Link
            href={path === "/calendar" ? `${path}?month=${params.month}` : path}
            className="inline-flex min-h-11 items-center rounded-pill px-4 text-sm text-secondary"
          >
            Clear filters
          </Link>
        </div>
      </form>
    </details>
  );
}
