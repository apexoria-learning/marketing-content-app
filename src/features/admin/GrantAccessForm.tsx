"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GrantAccessInputSchema, type AppRole } from "@/lib/schemas/admin";
import { grantUserAccess } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

export const ROLE_SEGMENTS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
] as const;

export function GrantAccessForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("member");
  const [canGenerate, setCanGenerate] = useState(true);
  const { pending, error, fields, run } = useAdminAction();
  const [emailError, setEmailError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const input = { email, role, can_generate: canGenerate };
    const parsed = GrantAccessInputSchema.safeParse(input);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "Check this field.");
      return;
    }
    setEmailError("");
    run(
      () => grantUserAccess(parsed.data),
      (data) => {
        setEmail("");
        return data.status === "granted"
          ? `Access granted to ${data.email}.`
          : `Access updated for ${data.email}.`;
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Input
        label="Google account email"
        type="email"
        autoComplete="off"
        inputMode="email"
        placeholder="name@gmail.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={pending}
        error={emailError || fields.email}
        helper="They can sign in with this Google account straight away."
      />
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
      <Button type="submit" loading={pending}>
        Grant access
      </Button>
    </form>
  );
}
