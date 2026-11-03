"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import { FORMAT_LABELS } from "@/components/content/FormatChip";
import { PLATFORM_SLOT_CLASSES } from "@/components/content/PlatformBadge";
import { FormatSchema, type ContentFormat } from "@/lib/schemas/content";
import {
  PLATFORM_COLOUR_SLOTS,
  PLATFORM_ICONS,
  PlatformInputSchema,
  toPlatformIcon,
  type PlatformIcon,
  type PlatformRecord,
} from "@/lib/schemas/platforms";
import { cx } from "@/lib/utils/cx";
import { suggestCatalogueKey } from "@/lib/utils/catalogue-key";
import { savePlatform } from "@/server/actions/admin";
import { useAdminAction } from "./use-admin-action";

const COLOUR_NAMES: Record<number, string> = {
  1: "Pink",
  2: "Blue",
  3: "Green",
  4: "Orange",
  5: "Violet",
  6: "Cyan",
  7: "Lime",
  8: "Slate",
};

const ICON_NAMES: Record<PlatformIcon, string> = {
  platform: "Generic",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  globe: "Globe",
  video: "Video",
  chat: "Chat",
  briefcase: "Briefcase",
  megaphone: "Megaphone",
};

function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

const legendClasses =
  "mb-2 text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase";

export function PlatformForm({
  existing,
  onDone,
}: {
  existing: PlatformRecord | null;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [key, setKey] = useState(existing?.key ?? "");
  const [isKeyEdited, setIsKeyEdited] = useState(false);
  const [isEnabled, setIsEnabled] = useState(existing?.is_enabled ?? true);
  const [colourSlot, setColourSlot] = useState(existing?.colour_slot ?? 4);
  const [icon, setIcon] = useState<PlatformIcon>(
    toPlatformIcon(existing?.icon ?? "platform"),
  );
  const [formats, setFormats] = useState<ContentFormat[]>(
    existing?.formats ?? ["post"],
  );
  const [allowsHashtags, setAllowsHashtags] = useState(
    existing?.allows_hashtags ?? true,
  );
  const [maxHashtags, setMaxHashtags] = useState(
    String(existing?.max_hashtags ?? 5),
  );
  const [captionLimit, setCaptionLimit] = useState(
    existing?.caption_max_chars ? String(existing.caption_max_chars) : "",
  );
  const [tone, setTone] = useState(existing?.tone ?? "");
  const [guidance, setGuidance] = useState(existing?.guidance ?? "");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const { pending, error, fields, run } = useAdminAction();
  const errors = { ...fields, ...localErrors };
  const isCreate = existing === null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = PlatformInputSchema.safeParse({
      key: key.trim(),
      label,
      is_enabled: isEnabled,
      colour_slot: colourSlot,
      icon,
      formats: FormatSchema.options.filter((format) =>
        formats.includes(format),
      ),
      allows_hashtags: allowsHashtags,
      max_hashtags: allowsHashtags ? Number(maxHashtags) : 0,
      caption_max_chars: captionLimit.trim() ? Number(captionLimit) : null,
      tone,
      guidance,
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
        savePlatform({
          mode: isCreate ? "create" : "update",
          platform: parsed.data,
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
        maxLength={40}
        disabled={pending}
        placeholder="YouTube Shorts"
        error={errors.label}
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
      <Checkbox
        label="Use in new plans"
        checked={isEnabled}
        disabled={pending}
        helper="Turning this off retires the platform. Its existing content stays visible."
        onChange={(event) => setIsEnabled(event.target.checked)}
      />
      <fieldset disabled={pending}>
        <legend className={legendClasses}>Colour</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_COLOUR_SLOTS.map((slot) => (
            <Chip
              key={slot}
              selected={colourSlot === slot}
              onClick={() => setColourSlot(slot)}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "inline-flex size-5 items-center justify-center rounded-pill",
                  PLATFORM_SLOT_CLASSES[slot],
                )}
              >
                <span className="size-2 rounded-pill bg-current" />
              </span>
              {COLOUR_NAMES[slot]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={pending}>
        <legend className={legendClasses}>Icon</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_ICONS.map((name) => (
            <Chip
              key={name}
              selected={icon === name}
              onClick={() => setIcon(name)}
            >
              <Icon name={name} size="chip" />
              {ICON_NAMES[name]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={pending}>
        <legend className={legendClasses}>Formats</legend>
        <div className="flex flex-wrap gap-2">
          {FormatSchema.options.map((format) => (
            <Chip
              key={format}
              selected={formats.includes(format)}
              onClick={() => setFormats((value) => toggle(value, format))}
            >
              {FORMAT_LABELS[format]}
            </Chip>
          ))}
        </div>
        {errors.formats ? (
          <p role="alert" className="mt-2 text-caption text-danger">
            {errors.formats}
          </p>
        ) : null}
      </fieldset>
      <div className="space-y-3">
        <Checkbox
          label="Allow hashtags"
          checked={allowsHashtags}
          disabled={pending}
          onChange={(event) => setAllowsHashtags(event.target.checked)}
        />
        {allowsHashtags ? (
          <Input
            label="Maximum hashtags"
            inputMode="numeric"
            value={maxHashtags}
            disabled={pending}
            error={errors.max_hashtags}
            helper="0–30."
            onChange={(event) => setMaxHashtags(event.target.value)}
          />
        ) : null}
      </div>
      <Input
        label="Caption limit (characters)"
        inputMode="numeric"
        value={captionLimit}
        disabled={pending}
        error={errors.caption_max_chars}
        helper="Optional, 50–10,000. Leave empty for no limit."
        onChange={(event) => setCaptionLimit(event.target.value)}
      />
      <Textarea
        label="Tone"
        value={tone}
        maxLength={2000}
        disabled={pending}
        error={errors.tone}
        placeholder="Short, energetic and visual. Lead with the payoff."
        helper="How content for this platform should sound."
        onChange={(event) => setTone(event.target.value)}
      />
      <Textarea
        label="AI guidance"
        value={guidance}
        maxLength={1000}
        disabled={pending}
        error={errors.guidance}
        placeholder="Write for vertical video. Keep on-screen text under 8 words."
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
          {isCreate ? "Add platform" : "Save platform"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
