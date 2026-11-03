"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Textarea } from "@/components/ui/Input";
import { PILLAR_LABELS } from "@/components/content/PillarChip";
import { PillarSchema, type Pillar } from "@/lib/schemas/content";
import {
  AppSettingsUpdateSchema,
  MIN_TOPIC_PILLARS,
} from "@/lib/schemas/admin";
import { updateAppSettings } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

export type PlanningFilterValues = {
  enabledPillars: Pillar[];
  newsFeedUrls: string[];
};

function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function sameSet<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

export function PlanningFiltersForm({
  effective,
  isOverridden,
}: {
  effective: PlanningFilterValues;
  isOverridden: boolean;
}) {
  const [pillars, setPillars] = useState(effective.enabledPillars);
  const [feeds, setFeeds] = useState(effective.newsFeedUrls.join("\n"));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const { pending, error, fields, run } = useAdminAction();
  const feedList = feeds
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const changes = {
    ...(sameSet(pillars, effective.enabledPillars)
      ? {}
      : { enabled_pillars: pillars }),
    ...(feedList.join("\n") === effective.newsFeedUrls.join("\n")
      ? {}
      : { news_feed_urls: feedList }),
  };
  const hasChanges = Object.keys(changes).length > 0;
  const errors = { ...fields, ...localErrors };

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = AppSettingsUpdateSchema.safeParse(changes);
    if (!parsed.success) {
      setLocalErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0] ?? "input"),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setLocalErrors({});
    run(
      () => updateAppSettings(parsed.data),
      () => "Filters saved. New plans use them.",
    );
  }

  function resetToDefaults() {
    setLocalErrors({});
    run(
      () =>
        updateAppSettings({
          enabled_pillars: null,
          news_feed_urls: null,
        }),
      () => "Filters reset to the environment defaults.",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <fieldset className="space-y-3" disabled={pending}>
        <legend className="mb-3 text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
          Content pillars
        </legend>
        <div className="flex flex-wrap gap-2">
          {PillarSchema.options.map((pillar) => (
            <Chip
              key={pillar}
              selected={pillars.includes(pillar)}
              onClick={() => setPillars((value) => toggle(value, pillar))}
            >
              {PILLAR_LABELS[pillar]}
            </Chip>
          ))}
        </div>
        <p className="text-caption text-secondary">
          Keep at least {MIN_TOPIC_PILLARS} pillars besides News so the planner
          can avoid repeating a pillar on consecutive days.
        </p>
        {errors.enabled_pillars ? (
          <p role="alert" className="text-caption text-danger">
            {errors.enabled_pillars}
          </p>
        ) : null}
      </fieldset>
      <Textarea
        label="News feeds"
        value={feeds}
        onChange={(event) => setFeeds(event.target.value)}
        disabled={pending}
        placeholder="https://www.salesforce.com/news/feed/"
        error={errors.news_feed_urls}
        helper="One HTTPS feed per line. Leave empty to turn news off. Used by the scheduled news job once it is switched on."
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending} disabled={!hasChanges}>
          Save filters
        </Button>
        {isOverridden ? (
          <Button variant="ghost" disabled={pending} onClick={resetToDefaults}>
            Reset to defaults
          </Button>
        ) : null}
      </div>
    </form>
  );
}
