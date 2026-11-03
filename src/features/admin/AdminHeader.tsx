import { PageHeader } from "@/components/shell/PageHeader";
import { AdminSectionNav, type AdminSection } from "./AdminSectionNav";

export type { AdminSection } from "./AdminSectionNav";

export function AdminHeader({ active }: { active: AdminSection }) {
  return (
    <>
      <PageHeader back title="Admin" />
      <AdminSectionNav active={active} />
    </>
  );
}
