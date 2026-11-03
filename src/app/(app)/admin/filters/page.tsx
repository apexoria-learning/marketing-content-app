import type { Metadata } from "next";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { PlanningFiltersForm } from "@/features/admin/PlanningFiltersForm";
import { requireAdminPage } from "@/server/auth/admin";
import { getAdminSettings } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · News" };

export default async function AdminFiltersPage() {
  const admin = await requireAdminPage();
  const { overrides, effective } = await getAdminSettings(admin);
  return (
    <>
      <AdminHeader active="filters" />
      <div className="mb-6 space-y-2">
        <h2 className="font-display text-h3 font-semibold text-primary">
          News feeds
        </h2>
        <p className="text-sm text-secondary">
          Where verified news comes from. Pillars marked &ldquo;Needs
          news&rdquo; are planned only when these feeds have articles. Platforms
          and pillars are managed on their own pages.
        </p>
      </div>
      {/* Remount after each save so local state matches the saved values. */}
      <PlanningFiltersForm
        key={overrides.updated_at}
        effective={{ newsFeedUrls: effective.newsFeedUrls }}
        isOverridden={overrides.news_feed_urls !== null}
      />
    </>
  );
}
