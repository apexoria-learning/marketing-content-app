"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/feedback/States";
import {
  EDITORIAL_INSTRUCTIONS_MAX,
  SaveInstructionsInputSchema,
  type PromptInstruction,
  type PromptScope,
} from "@/lib/schemas/admin";
import { formatCount } from "@/lib/format/numbers";
import { displayTimestamp } from "@/lib/utils/dates";
import { saveEditorialInstructions } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

const SCOPES = [
  { value: "content", label: "Content" },
  { value: "planning", label: "Planning" },
  { value: "daily_tip", label: "Daily tip" },
] as const;

const SCOPE_HELP: Record<PromptScope, string> = {
  content:
    "Used when writing captions, slides, scripts and design briefs for an item.",
  planning: "Used when planning a month or filling an empty day.",
  daily_tip: "Used by the daily tip once the scheduled job is switched on.",
};

export function InstructionsEditor({
  history,
}: {
  history: Record<PromptScope, PromptInstruction[]>;
}) {
  const [scope, setScope] = useState<PromptScope>("content");
  const [drafts, setDrafts] = useState<Record<PromptScope, string>>({
    content: history.content[0]?.instructions ?? "",
    planning: history.planning[0]?.instructions ?? "",
    daily_tip: history.daily_tip[0]?.instructions ?? "",
  });
  const [inputError, setInputError] = useState("");
  const { pending, error, run, clear } = useAdminAction();
  const versions = history[scope];
  const active = versions[0];
  const draft = drafts[scope];
  const isUnchanged = draft.trim() === (active?.instructions ?? "");

  function setDraft(value: string) {
    setDrafts((current) => ({ ...current, [scope]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = SaveInstructionsInputSchema.safeParse({
      scope,
      instructions: draft,
    });
    if (!parsed.success) {
      setInputError(parsed.error.issues[0]?.message ?? "Check this field.");
      return;
    }
    setInputError("");
    run(
      () => saveEditorialInstructions(parsed.data),
      (data) =>
        !data.changed
          ? "No changes to save."
          : parsed.data.instructions
            ? `Saved as version ${data.version}. New generations use it.`
            : "Instructions cleared. Only built-in rules apply.",
    );
  }

  return (
    <div className="space-y-6">
      <SegmentedControl
        label="Prompt"
        segments={SCOPES}
        value={scope}
        onChange={(value) => {
          setScope(value);
          setInputError("");
          clear();
        }}
      />
      <p className="text-sm text-secondary">{SCOPE_HELP[scope]}</p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Textarea
          label="Editorial instructions"
          value={draft}
          maxLength={EDITORIAL_INSTRUCTIONS_MAX}
          onChange={(event) => setDraft(event.target.value)}
          disabled={pending}
          placeholder="Prefer examples from Indian companies. Keep LinkedIn posts under 150 words."
          error={inputError}
          helper={`${formatCount(draft.length)} / ${formatCount(EDITORIAL_INSTRUCTIONS_MAX)} characters`}
        />
        <p className="text-caption text-secondary">
          {active?.instructions
            ? `Active: version ${active.id}, saved by ${active.created_by ?? "unknown"} on ${displayTimestamp(active.created_at)} IST.`
            : "No instructions yet: only the built-in rules apply."}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending} disabled={isUnchanged}>
            Save instructions
          </Button>
          {draft ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setDraft("")}
            >
              Clear text
            </Button>
          ) : null}
        </div>
      </form>
      <section aria-labelledby="instruction-history" className="space-y-3">
        <h2
          id="instruction-history"
          className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase"
        >
          History · {versions.length}
        </h2>
        {versions.length === 0 ? (
          <EmptyState
            glyph="layers"
            statement="No saved versions yet."
            guidance="Every save is kept here so you can return to an earlier version."
          />
        ) : (
          <ol className="space-y-3">
            {versions.map((version) => (
              <li
                key={version.id}
                className="space-y-2 rounded-lg border border-border bg-surface-1 p-4"
              >
                <p className="text-caption text-secondary">
                  Version {version.id} · {version.created_by ?? "unknown"} ·{" "}
                  {displayTimestamp(version.created_at)} IST
                  {version.id === active?.id ? " · Active" : ""}
                </p>
                <p className="whitespace-pre-wrap text-body text-primary">
                  {version.instructions || "(Cleared: built-in rules only)"}
                </p>
                {version.id !== active?.id ? (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setDraft(version.instructions)}
                  >
                    Use this text
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
