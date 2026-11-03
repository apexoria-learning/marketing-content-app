"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { AppSettingsUpdateSchema } from "@/lib/schemas/admin";
import { updateAppSettings } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

// Platforms and pillars are managed in their catalogues (Admin → Platforms,
// Admin → Pillars); this form keeps the news sources for news pillars.
export type PlanningFilterValues = {
  newsFeedUrls: string[];
};

export function PlanningFiltersForm({
  effective,
  isOverridden,
}: {
  effective: PlanningFilterValues;
  isOverridden: boolean;
}) {
  const [feeds, setFeeds] = useState(effective.newsFeedUrls.join("\n"));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const { pending, error, fields, run } = useAdminAction();
  const feedList = feeds
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const changes = {
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
      () => "News feeds saved.",
    );
  }

  function resetToDefaults() {
    setLocalErrors({});
    run(
      () =>
        updateAppSettings({
          news_feed_urls: null,
        }),
      () => "News feeds reset to the environment defaults.",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
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
          Save news feeds
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
