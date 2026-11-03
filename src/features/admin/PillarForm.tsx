"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input, Textarea } from "@/components/ui/Input";
import { PillarInputSchema, type PillarRecord } from "@/lib/schemas/pillars";
import { suggestCatalogueKey } from "@/lib/utils/catalogue-key";
import { savePillar } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

export function PillarForm({
  existing,
  onDone,
}: {
  existing: PillarRecord | null;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [key, setKey] = useState(existing?.key ?? "");
  const [isKeyEdited, setIsKeyEdited] = useState(false);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [guidance, setGuidance] = useState(existing?.guidance ?? "");
  const [requiresNews, setRequiresNews] = useState(
    existing?.requires_news ?? false,
  );
  const [isEnabled, setIsEnabled] = useState(existing?.is_enabled ?? true);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const { pending, error, fields, run } = useAdminAction();
  const errors = { ...fields, ...localErrors };
  const isCreate = existing === null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = PillarInputSchema.safeParse({
      key: key.trim(),
      label,
      description,
      guidance,
      requires_news: requiresNews,
      is_enabled: isEnabled,
    });
    if (!parsed.success) {
      setLocalErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0] ?? "input"),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setLocalErrors({});
    run(
      () =>
        savePillar({
          mode: isCreate ? "create" : "update",
          pillar: parsed.data,
        }),
      (data) => {
        onDone();
        return data.status === "created"
          ? `${parsed.data.label} added.`
          : `${parsed.data.label} saved.`;
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Input
        label="Name"
        value={label}
        maxLength={30}
        disabled={pending}
        placeholder="Python tips"
        error={errors.label}
        helper="Short; shown on chips and filters."
        onChange={(event) => {
          setLabel(event.target.value);
          if (isCreate && !isKeyEdited)
            setKey(suggestCatalogueKey(event.target.value));
        }}
      />
      {isCreate ? (
        <Input
          label="Key"
          value={key}
          maxLength={30}
          disabled={pending}
          autoComplete="off"
          spellCheck={false}
          error={errors.key}
          helper="Permanent ID stored on content. Lowercase letters, numbers and underscores."
          onChange={(event) => {
            setKey(event.target.value);
            setIsKeyEdited(true);
          }}
        />
      ) : (
        <p className="text-caption text-secondary">
          Key: <span className="font-mono">{existing.key}</span> (permanent)
        </p>
      )}
      <Textarea
        label="Purpose"
        value={description}
        maxLength={300}
        disabled={pending}
        error={errors.description}
        placeholder="Teach one small, practical Python technique."
        helper="What content in this pillar is for. The planner uses it to pick topics."
        onChange={(event) => setDescription(event.target.value)}
      />
      <Checkbox
        label="Needs verified news"
        checked={requiresNews}
        disabled={pending}
        helper="Planned only when news feeds have articles, and every item must cite a supplied source."
        onChange={(event) => setRequiresNews(event.target.checked)}
      />
      <Checkbox
        label="Use in new plans"
        checked={isEnabled}
        disabled={pending}
        helper="Turning this off retires the pillar. Its existing content stays visible."
        onChange={(event) => setIsEnabled(event.target.checked)}
      />
      <Textarea
        label="AI guidance"
        value={guidance}
        maxLength={1000}
        disabled={pending}
        error={errors.guidance}
        placeholder="Always include a runnable code snippet."
        helper="Optional extra instructions. Built-in factual and format rules still come first."
        onChange={(event) => setGuidance(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {isCreate ? "Add pillar" : "Save pillar"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
