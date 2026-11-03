"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { AppRole } from "@/lib/schemas/admin";
import type { ActionResult } from "@/lib/schemas/action-result";
import { formatTokens } from "@/lib/format/numbers";
import { displayTimestamp } from "@/lib/utils/dates";
import type { DirectoryEntry } from "@/lib/utils/user-directory";
import { grantUserAccess, updateUserAccess } from "@/server/actions/admin";
import { ROLE_SEGMENTS } from "./GrantAccessForm";
import { useAdminAction } from "./use-admin-action";

const ACCESS_LABELS: Record<DirectoryEntry["access"], string> = {
  owner: "Owner",
  granted: "Has access",
  environment: "Has access (env list)",
  revoked: "Revoked",
  no_access: "No access",
};

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-pill border border-border px-2 py-0.5 text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
      {children}
    </span>
  );
}

export function UserAccessRow({
  entry,
  isSelf,
}: {
  entry: DirectoryEntry;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AppRole>(entry.role);
  const [canGenerate, setCanGenerate] = useState(
    entry.access === "no_access" ? true : entry.can_generate,
  );
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const { pending, error, run, clear } = useAdminAction();
  const locked = entry.access === "owner" || isSelf;
  const hasAccess = ["owner", "granted", "environment"].includes(entry.access);
  const displayName = entry.name ?? entry.email;

  function close() {
    if (pending) return;
    setOpen(false);
    setConfirmRevoke(false);
    clear();
  }

  function save(
    execute: () => Promise<ActionResult<{ email: string }>>,
    message: string,
  ) {
    run(execute, () => {
      setOpen(false);
      setConfirmRevoke(false);
      return message;
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-primary">{displayName}</p>
        {entry.name ? (
          <p className="text-sm text-secondary">{entry.email}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Badge>{ACCESS_LABELS[entry.access]}</Badge>
          {hasAccess ? (
            <Badge>{entry.role === "admin" ? "Admin" : "Member"}</Badge>
          ) : null}
          {hasAccess && !entry.can_generate ? <Badge>AI off</Badge> : null}
          {isSelf ? <Badge>You</Badge> : null}
        </div>
        <p className="text-caption text-secondary tabular-nums">
          {entry.last_active_at
            ? `Last active ${displayTimestamp(entry.last_active_at)} IST`
            : "No recorded activity"}
          {entry.tokens
            ? ` · ${formatTokens(entry.tokens)} tokens in 30 days`
            : ""}
        </p>
      </div>
      {locked ? (
        <p className="text-caption text-secondary">
          {entry.access === "owner"
            ? "Managed in server settings"
            : "Ask another admin"}
        </p>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {entry.access === "no_access" ? "Grant access" : "Manage"}
        </Button>
      )}
      <BottomSheet
        open={open}
        title={
          entry.access === "no_access"
            ? `Grant access to ${displayName}`
            : `Manage ${displayName}`
        }
        onClose={close}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
              Role
            </p>
            <SegmentedControl
              label="Role"
              segments={ROLE_SEGMENTS}
              value={role}
              onChange={setRole}
            />
          </div>
          <Checkbox
            label="Can use AI generation"
            checked={canGenerate}
            onChange={(event) => setCanGenerate(event.target.checked)}
            disabled={pending}
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {entry.access === "no_access" ? (
            <Button
              loading={pending}
              onClick={() =>
                save(
                  () =>
                    grantUserAccess({
                      email: entry.email,
                      role,
                      can_generate: canGenerate,
                    }),
                  `Access granted to ${entry.email}.`,
                )
              }
            >
              Grant access
            </Button>
          ) : null}
          {entry.access === "revoked" ? (
            <Button
              loading={pending}
              onClick={() =>
                save(
                  () =>
                    updateUserAccess({
                      email: entry.email,
                      role,
                      can_generate: canGenerate,
                      is_active: true,
                    }),
                  `Access restored for ${entry.email}.`,
                )
              }
            >
              Restore access
            </Button>
          ) : null}
          {hasAccess ? (
            <div className="flex flex-wrap gap-3">
              <Button
                loading={pending && !confirmRevoke}
                disabled={pending}
                onClick={() =>
                  save(
                    () =>
                      updateUserAccess({
                        email: entry.email,
                        role,
                        can_generate: canGenerate,
                      }),
                    `Changes saved for ${entry.email}.`,
                  )
                }
              >
                Save changes
              </Button>
              {!confirmRevoke ? (
                <Button
                  variant="ghost"
                  className="text-danger!"
                  disabled={pending}
                  onClick={() => setConfirmRevoke(true)}
                >
                  Revoke access
                </Button>
              ) : null}
            </div>
          ) : null}
          {hasAccess && confirmRevoke ? (
            <div
              role="group"
              aria-label="Confirm revoke"
              className="space-y-3 rounded-md border border-danger bg-danger-muted p-4"
            >
              <p className="text-sm text-danger">
                {entry.email} will lose access on their next request and be
                signed out. Their past work stays in the app.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="danger"
                  loading={pending}
                  onClick={() =>
                    save(
                      () =>
                        updateUserAccess({
                          email: entry.email,
                          is_active: false,
                        }),
                      `Access revoked for ${entry.email}.`,
                    )
                  }
                >
                  Confirm revoke
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setConfirmRevoke(false)}
                >
                  Keep access
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </BottomSheet>
    </li>
  );
}
