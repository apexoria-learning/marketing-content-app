import type { Metadata } from "next";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { PillarManager } from "@/features/admin/PillarManager";
import { MAX_ENABLED_PILLARS, MIN_TOPIC_PILLARS } from "@/lib/schemas/pillars";
import { requireAdminPage } from "@/server/auth/admin";
import { getPillarCatalogueForAdmin } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Pillars" };

export default async function AdminPillarsPage() {
  const admin = await requireAdminPage();
  const pillars = await getPillarCatalogueForAdmin(admin);
  return (
    <>
      <AdminHeader active="pillars" />
      <div className="mb-6 space-y-2">
        <h2 className="font-display text-h3 font-semibold text-primary">
          Pillars
        </h2>
        <p className="text-sm text-secondary">
          The themes each month rotates through. The planner uses every enabled
          pillar at least twice a month, guided by its purpose. Keep at least{" "}
          {MIN_TOPIC_PILLARS} enabled pillars that do not need news, and no more
          than {MAX_ENABLED_PILLARS} in total. Retired pillars keep their past
          content.
        </p>
      </div>
      <PillarManager pillars={pillars} />
    </>
  );
}
