"use client";

import { Banner } from "@/components/feedback/Banner";
import { importAllowlist } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

export function ImportAllowlistControl({ count }: { count: number }) {
  const { pending, error, run } = useAdminAction();
  return (
    <div className="space-y-2">
      <Banner
        variant="accent"
        icon="lock"
        progress={pending}
        action={
          pending
            ? undefined
            : {
                label: "Import",
                onAction: () =>
                  run(
                    () => importAllowlist({}),
                    (data) =>
                      data.imported
                        ? `Imported ${data.imported} ${data.imported === 1 ? "person" : "people"}. You can now remove ALLOWED_EMAILS.`
                        : "Everyone was already imported.",
                  ),
              }
        }
      >
        {count} {count === 1 ? "person gets" : "people get"} access from the
        ALLOWED_EMAILS environment list. Import them to manage access here.
      </Banner>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
