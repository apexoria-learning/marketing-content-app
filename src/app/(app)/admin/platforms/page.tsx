import type { Metadata } from "next";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { PlatformManager } from "@/features/admin/PlatformManager";
import { requireAdminPage } from "@/server/auth/admin";
import { getPlatformCatalogueForAdmin } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Platforms" };

export default async function AdminPlatformsPage() {
  const admin = await requireAdminPage();
  const platforms = await getPlatformCatalogueForAdmin(admin);
  return (
    <>
      <AdminHeader active="platforms" />
      <div className="mb-6 space-y-2">
        <h2 className="font-display text-h3 font-semibold text-primary">
          Platforms
        </h2>
        <p className="text-sm text-secondary">
          Where your team posts. Each platform sets its formats, hashtag rule,
          tone and AI guidance. Changes apply to new plans and generations;
          retired platforms keep their past content.
        </p>
      </div>
      <PlatformManager platforms={platforms} />
    </>
  );
}
