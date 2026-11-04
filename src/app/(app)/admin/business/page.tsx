import type { Metadata } from "next";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { BusinessProfileForm } from "@/features/admin/BusinessProfileForm";
import { toBusinessProfileInput } from "@/lib/schemas/business-profile";
import { requireAdminPage } from "@/server/auth/admin";
import { getBusinessProfileForAdmin } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Business" };

export default async function AdminBusinessPage() {
  const admin = await requireAdminPage();
  const profile = await getBusinessProfileForAdmin(admin);
  return (
    <>
      <AdminHeader active="business" />
      <div className="mb-6 space-y-2">
        <h2 className="font-display text-h3 font-semibold text-primary">
          Business profile
        </h2>
        <p className="text-sm text-secondary">
          What the AI knows about the business. Every plan, post and daily tip
          is written from this profile, so it can describe any industry. Changes
          apply to new generations only; existing content is never rewritten.
          Tone is set per platform.
          {profile.updated_by ? ` Last changed by ${profile.updated_by}.` : ""}
        </p>
      </div>
      {/* Remount after each save so local state matches the saved values. */}
      <BusinessProfileForm
        key={profile.updated_at}
        profile={toBusinessProfileInput(profile)}
      />
    </>
  );
}
