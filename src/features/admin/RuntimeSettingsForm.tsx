"use client";

import { useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import {
  AppSettingsUpdateSchema,
  type AppSettingsUpdate,
} from "@/lib/schemas/admin";
import { updateAppSettings } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

export type RuntimeSettingValues = {
  ai_generation_enabled: boolean;
  regen_daily_limit: number;
  global_daily_ai_limit: number;
  plan_day_of_month: number;
  planning_horizon_months: number;
  ai_model: string;
  ai_base_url: string;
};

type ValueField = Exclude<keyof RuntimeSettingValues, "ai_generation_enabled">;

const SECTIONS: {
  title: string;
  fields: {
    key: ValueField;
    label: string;
    helper: string;
    numeric?: boolean;
  }[];
}[] = [
  {
    title: "Limits",
    fields: [
      {
        key: "regen_daily_limit",
        label: "AI requests per person per day",
        helper: "Resets at midnight IST.",
        numeric: true,
      },
      {
        key: "global_daily_ai_limit",
        label: "AI requests for the whole team per day",
        helper: "The spending backstop across everyone.",
        numeric: true,
      },
    ],
  },
  {
    title: "Planning",
    fields: [
      {
        key: "planning_horizon_months",
        label: "Months ahead that can be planned",
        helper: "Up to 12.",
        numeric: true,
      },
      {
        key: "plan_day_of_month",
        label: "Day of the month to plan next month",
        helper: "Used by the scheduled planning job once it is switched on.",
        numeric: true,
      },
    ],
  },
  {
    title: "AI provider",
    fields: [
      {
        key: "ai_model",
        label: "Model alias",
        helper: "Exactly as configured in the gateway.",
      },
      {
        key: "ai_base_url",
        label: "Gateway URL",
        helper: "HTTPS address ending in /v1.",
      },
    ],
  },
];

type SettingKey = keyof RuntimeSettingValues;

export function RuntimeSettingsForm({
  effective,
  defaults,
  overridden,
}: {
  effective: RuntimeSettingValues;
  defaults: RuntimeSettingValues;
  overridden: Record<SettingKey, boolean>;
}) {
  const [enabled, setEnabled] = useState(effective.ai_generation_enabled);
  const [values, setValues] = useState<Record<ValueField, string>>({
    regen_daily_limit: String(effective.regen_daily_limit),
    global_daily_ai_limit: String(effective.global_daily_ai_limit),
    plan_day_of_month: String(effective.plan_day_of_month),
    planning_horizon_months: String(effective.planning_horizon_months),
    ai_model: effective.ai_model,
    ai_base_url: effective.ai_base_url,
  });
  const [resets, setResets] = useState<SettingKey[]>([]);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [pendingChanges, setPendingChanges] =
    useState<AppSettingsUpdate | null>(null);
  const { pending, error, fields, run } = useAdminAction();
  const errors = { ...fields, ...localErrors };

  function changes(): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if (resets.includes("ai_generation_enabled"))
      patch.ai_generation_enabled = null;
    else if (enabled !== effective.ai_generation_enabled)
      patch.ai_generation_enabled = enabled;
    for (const section of SECTIONS)
      for (const field of section.fields) {
        if (resets.includes(field.key)) {
          patch[field.key] = null;
          continue;
        }
        const raw = values[field.key].trim();
        if (raw === String(effective[field.key])) continue;
        patch[field.key] = field.numeric
          ? raw === ""
            ? Number.NaN
            : Number(raw)
          : raw;
      }
    return patch;
  }

  function save(patch: AppSettingsUpdate) {
    setPendingChanges(null);
    run(
      () => updateAppSettings(patch),
      () => {
        setResets([]);
        return "Settings saved. They apply to the next request.";
      },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = AppSettingsUpdateSchema.safeParse(changes());
    if (!parsed.success) {
      setLocalErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0] ?? "input"),
            issue.path[0] === undefined ? issue.message : "Check this value.",
          ]),
        ),
      );
      return;
    }
    setLocalErrors({});
    // Provider changes redirect where the server's gateway key is sent.
    if (parsed.data.ai_model || parsed.data.ai_base_url)
      setPendingChanges(parsed.data);
    else save(parsed.data);
  }

  function applyDefault(key: SettingKey) {
    setResets((current) => [...new Set([...current, key])]);
    if (key === "ai_generation_enabled") setEnabled(defaults[key]);
    else setValues((current) => ({ ...current, [key]: String(defaults[key]) }));
  }

  function defaultNote(setting: SettingKey) {
    const isCustom = overridden[setting] && !resets.includes(setting);
    return (
      <span className="flex flex-wrap items-center gap-2">
        {isCustom
          ? `Custom value. Default: ${String(defaults[setting])}.`
          : "Using the default."}
        {isCustom ? (
          <Button
            variant="ghost"
            className="min-h-11 px-2"
            disabled={pending}
            onClick={() => applyDefault(setting)}
          >
            Use default
          </Button>
        ) : null}
      </span>
    );
  }

  const isDirty = Object.keys(changes()).length > 0;
  const nextProvider = {
    url:
      pendingChanges?.ai_base_url === undefined
        ? effective.ai_base_url
        : (pendingChanges.ai_base_url ?? defaults.ai_base_url),
    model:
      pendingChanges?.ai_model === undefined
        ? effective.ai_model
        : (pendingChanges.ai_model ?? defaults.ai_model),
  };

  return (
    <form onSubmit={submit} className="space-y-10" noValidate>
      <section className="space-y-3">
        <h2 className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
          AI generation
        </h2>
        <Checkbox
          label="AI generation is on for the team"
          checked={enabled}
          disabled={pending}
          onChange={(event) => {
            setEnabled(event.target.checked);
            setResets((current) =>
              current.filter((key) => key !== "ai_generation_enabled"),
            );
          }}
          helper={
            <>
              When off, no one can generate. Existing content is not affected.{" "}
              {defaultNote("ai_generation_enabled")}
            </>
          }
        />
      </section>
      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-5">
          <h2 className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
            {section.title}
          </h2>
          {section.fields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={values[field.key]}
              inputMode={field.numeric ? "numeric" : "url"}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }));
                setResets((current) =>
                  current.filter((key) => key !== field.key),
                );
              }}
              error={errors[field.key]}
              helper={
                <>
                  {field.helper} {defaultNote(field.key)}
                </>
              }
            />
          ))}
        </section>
      ))}
      <p className="text-caption text-secondary">
        The gateway API key stays in the server environment and is never shown
        or stored here.
      </p>
      {error || errors.input ? (
        <p role="alert" className="text-sm text-danger">
          {error || errors.input}
        </p>
      ) : null}
      <Button type="submit" loading={pending} disabled={!isDirty}>
        Save settings
      </Button>
      <BottomSheet
        open={pendingChanges !== null}
        title="Change the AI provider?"
        onClose={() => setPendingChanges(null)}
      >
        <div className="space-y-4">
          <p className="text-body text-primary">
            New generation requests will go to{" "}
            <span className="font-semibold">{nextProvider.url}</span> using
            model <span className="font-semibold">{nextProvider.model}</span>.
            The server sends its gateway key with each request.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              loading={pending}
              onClick={() => pendingChanges && save(pendingChanges)}
            >
              Change provider
            </Button>
            <Button variant="ghost" onClick={() => setPendingChanges(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </BottomSheet>
    </form>
  );
}
