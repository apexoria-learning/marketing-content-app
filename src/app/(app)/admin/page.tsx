import type { Metadata } from "next";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { AdminOverview } from "@/features/admin/AdminOverview";
import { requireAdminPage } from "@/server/auth/admin";
import { getAdminOverview } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const admin = await requireAdminPage();
  const overview = await getAdminOverview(admin);
  return (
    <>
      <AdminHeader active="overview" />
      <AdminOverview overview={overview} />
    </>
  );
}
