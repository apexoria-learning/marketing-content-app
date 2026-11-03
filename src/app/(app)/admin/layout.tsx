import type { ReactNode } from "react";
import { requireAdminPage } from "@/server/auth/admin";

// First gate; each page re-checks because layouts do not re-run on client
// navigation (ARCHITECTURE.md §6.4).
export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireAdminPage();
  return children;
}
