import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/States";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { GrantAccessForm } from "@/features/admin/GrantAccessForm";
import { ImportAllowlistControl } from "@/features/admin/ImportAllowlistControl";
import { UserAccessRow } from "@/features/admin/UserAccessRow";
import { hasAccess, type DirectoryEntry } from "@/lib/utils/user-directory";
import { requireAdminPage } from "@/server/auth/admin";
import { getUserDirectory } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Users" };

function Group({
  id,
  title,
  entries,
  self,
}: {
  id: string;
  title: string;
  entries: DirectoryEntry[];
  self: string;
}) {
  if (!entries.length) return null;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2
        id={id}
        className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase"
      >
        {title} · {entries.length}
      </h2>
      <ul className="space-y-3">
        {entries.map((entry) => (
          <UserAccessRow
            key={entry.email}
            entry={entry}
            isSelf={entry.email === self}
          />
        ))}
      </ul>
    </section>
  );
}

export default async function AdminUsersPage() {
  const admin = await requireAdminPage();
  const { entries, pending_import } = await getUserDirectory(admin);
  const awaiting = entries.filter((entry) => entry.access === "no_access");
  const members = entries.filter(hasAccess);
  const revoked = entries.filter((entry) => entry.access === "revoked");
  return (
    <>
      <AdminHeader active="users" />
      <div className="space-y-10">
        {pending_import.length ? (
          <ImportAllowlistControl count={pending_import.length} />
        ) : null}
        <section aria-labelledby="grant-heading" className="space-y-4">
          <h2
            id="grant-heading"
            className="font-display text-h3 font-semibold text-primary"
          >
            Give someone access
          </h2>
          <GrantAccessForm />
          <p className="text-caption text-secondary">
            If the Google sign-in screen is still in testing mode, also add them
            as a test user in Google Cloud Console.
          </p>
        </section>
        <Group
          id="awaiting-heading"
          title="Signed in without access"
          entries={awaiting}
          self={admin.email}
        />
        <Group
          id="members-heading"
          title="With access"
          entries={members}
          self={admin.email}
        />
        <Group
          id="revoked-heading"
          title="Revoked"
          entries={revoked}
          self={admin.email}
        />
        {entries.length === 0 ? (
          <EmptyState
            glyph="lock"
            statement="No one has access yet."
            guidance="Grant access above, then share the app link."
          />
        ) : null}
      </div>
    </>
  );
}
