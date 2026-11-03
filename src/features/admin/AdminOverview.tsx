import Link from "next/link";
import { Banner } from "@/components/feedback/Banner";
import { EmptyState } from "@/components/feedback/States";
import { PLATFORM_LABELS } from "@/components/content/PlatformBadge";
import { PILLAR_LABELS } from "@/components/content/PillarChip";
import { formatCount, formatTokens } from "@/lib/format/numbers";
import { displayDate } from "@/lib/utils/dates";
import type { AdminOverview as Overview } from "@/server/services/admin";

const RUN_KIND_LABELS: Record<string, string> = {
  month_skeleton: "Month and day planning",
  item_hydration: "Content generation",
  item_regeneration: "Regeneration",
  daily_tip: "Daily tip",
  news_ingest: "News ingestion",
};

const linkClasses =
  "inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <dt className="text-caption text-secondary">{label}</dt>
      <dd className="mt-1 font-display text-h2 font-semibold text-primary tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="mb-3 text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase"
    >
      {children}
    </h2>
  );
}

export function AdminOverview({ overview }: { overview: Overview }) {
  const { users, usage, allowance, config, names } = overview;
  const totalTokens = usage.totals.input_tokens + usage.totals.output_tokens;
  return (
    <div className="space-y-10">
      {!config.aiGenerationEnabled ? (
        <Banner variant="neutral" icon="lock">
          AI generation is off for everyone. Turn it on in Settings.
        </Banner>
      ) : null}

      <section aria-labelledby="people-heading">
        <SectionHeading id="people-heading">People</SectionHeading>
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="With access" value={formatCount(users.with_access)} />
          <Stat label="Active · 7 days" value={formatCount(users.active_7d)} />
          <Stat
            label="Active · 30 days"
            value={formatCount(users.active_30d)}
          />
          <Stat
            label="Signed in, no access"
            value={formatCount(users.awaiting_access)}
          />
        </dl>
        <p className="mt-3 text-caption text-secondary">
          Active means signed in, posted, added a note or generated content.
          {users.revoked ? ` ${formatCount(users.revoked)} revoked.` : ""}
        </p>
        <Link href="/admin/users" className={linkClasses}>
          Manage users
        </Link>
      </section>

      <section aria-labelledby="usage-heading">
        <SectionHeading id="usage-heading">
          {`AI usage · last ${usage.window_days} days`}
        </SectionHeading>
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Requests" value={formatCount(usage.totals.runs)} />
          <Stat label="Tokens" value={formatTokens(totalTokens)} />
          <Stat
            label="Input · output tokens"
            value={`${formatTokens(usage.totals.input_tokens)} · ${formatTokens(usage.totals.output_tokens)}`}
          />
          <Stat
            label="Failed requests"
            value={formatCount(usage.totals.failed)}
          />
        </dl>
        <p className="mt-3 text-caption text-secondary tabular-nums">
          Today: {formatCount(allowance.used)} of {formatCount(allowance.limit)}{" "}
          team generations used ({formatCount(allowance.per_user)} per person).{" "}
          {formatTokens(usage.today.input_tokens + usage.today.output_tokens)}{" "}
          tokens so far. Cost is not tracked yet.
        </p>
      </section>

      <section aria-labelledby="by-person-heading">
        <SectionHeading id="by-person-heading">Usage by person</SectionHeading>
        {usage.by_user.length === 0 ? (
          <EmptyState
            glyph="sparkle"
            statement="No AI usage in the last 30 days."
            guidance="Generations appear here with the person who started them."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface-1">
            {usage.by_user.map((row) => (
              <li
                key={row.email ?? "scheduled"}
                className="flex flex-wrap items-baseline justify-between gap-2 p-4"
              >
                <span className="min-w-0 text-primary">
                  {row.email
                    ? (names[row.email] ?? row.email)
                    : "Scheduled or earlier runs"}
                </span>
                <span className="text-sm text-secondary tabular-nums">
                  {formatTokens(row.input_tokens + row.output_tokens)} tokens ·{" "}
                  {formatCount(row.runs)} requests
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {usage.by_day.length ? (
        <section aria-labelledby="by-day-heading">
          <SectionHeading id="by-day-heading">Usage by day</SectionHeading>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface-1">
            {usage.by_day.map((row) => (
              <li
                key={row.date}
                className="flex flex-wrap items-baseline justify-between gap-2 p-4"
              >
                <time dateTime={row.date} className="text-primary">
                  {displayDate(row.date, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </time>
                <span className="text-sm text-secondary tabular-nums">
                  {formatTokens(row.input_tokens + row.output_tokens)} tokens ·{" "}
                  {formatCount(row.runs)} requests
                  {row.failed ? ` · ${formatCount(row.failed)} failed` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {usage.by_kind.length ? (
        <section aria-labelledby="by-kind-heading">
          <SectionHeading id="by-kind-heading">Usage by type</SectionHeading>
          <dl className="space-y-2 text-sm">
            {usage.by_kind.map((row) => (
              <div key={row.kind} className="flex justify-between gap-3">
                <dt className="text-secondary">
                  {RUN_KIND_LABELS[row.kind] ?? row.kind}
                </dt>
                <dd className="text-primary tabular-nums">
                  {formatTokens(row.input_tokens + row.output_tokens)} tokens
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="config-heading">
        <SectionHeading id="config-heading">Configuration</SectionHeading>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-secondary">AI generation</dt>
            <dd className="text-primary">
              {config.aiGenerationEnabled ? "On" : "Off"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-secondary">Model</dt>
            <dd className="min-w-0 text-right text-primary">
              {config.aiModel}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-secondary">Planning horizon</dt>
            <dd className="text-primary">
              {config.planningHorizonMonths} months
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-secondary">Platforms</dt>
            <dd className="text-right text-primary">
              {config.enabledPlatforms
                .map((platform) => PLATFORM_LABELS[platform])
                .join(", ")}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-secondary">Pillars</dt>
            <dd className="text-right text-primary">
              {config.enabledPillars
                .map((pillar) => PILLAR_LABELS[pillar])
                .join(", ")}
            </dd>
          </div>
        </dl>
        <Link href="/admin/settings" className={linkClasses}>
          Change settings
        </Link>
      </section>
    </div>
  );
}
