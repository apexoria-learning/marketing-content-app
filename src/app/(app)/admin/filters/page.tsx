import type { Metadata } from "next";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { PlanningFiltersForm } from "@/features/admin/PlanningFiltersForm";
import { requireAdminPage } from "@/server/auth/admin";
import { getAdminSettings } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Filters" };

export default async function AdminFiltersPage() {
  const admin = await requireAdminPage();
  const { overrides, effective } = await getAdminSettings(admin);
  return (
    <>
      <AdminHeader active="filters" />
      <div className="mb-6 space-y-2">
        <h2 className="font-display text-h3 font-semibold text-primary">
          Planning filters
        </h2>
        <p className="text-sm text-secondary">
          Choose which platforms and pillars new month and day plans may use.
          Content that is already planned is not changed.
        </p>
      </div>
      {/* Remount after each save so local state matches the saved values. */}
      <PlanningFiltersForm
        key={overrides.updated_at}
        effective={{
          enabledPlatforms: effective.enabledPlatforms,
          enabledPillars: effective.enabledPillars,
          newsFeedUrls: effective.newsFeedUrls,
        }}
        isOverridden={
          overrides.enabled_platforms !== null ||
          overrides.enabled_pillars !== null ||
          overrides.news_feed_urls !== null
        }
      />
    </>
  );
}
