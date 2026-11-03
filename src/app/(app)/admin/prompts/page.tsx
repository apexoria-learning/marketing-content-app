import type { Metadata } from "next";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { InstructionsEditor } from "@/features/admin/InstructionsEditor";
import { requireAdminPage } from "@/server/auth/admin";
import { getInstructionHistory } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Prompts" };

export default async function AdminPromptsPage() {
  const admin = await requireAdminPage();
  const history = await getInstructionHistory(admin);
  return (
    <>
      <AdminHeader active="prompts" />
      <div className="mb-6 space-y-2">
        <h2 className="font-display text-h3 font-semibold text-primary">
          Editorial instructions
        </h2>
        <p className="text-sm text-secondary">
          Add house style and focus to the AI prompts. Built-in rules always
          come first: content stays factual, sources are never invented and no
          personal data is sent. Changes apply to new generations only.
        </p>
      </div>
      <InstructionsEditor history={history} />
    </>
  );
}
