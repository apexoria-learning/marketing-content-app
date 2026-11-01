"use client";

import { useState, type ReactNode } from "react";
import { Banner } from "@/components/feedback/Banner";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon, ICON_NAMES } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusTick } from "@/components/ui/StatusTick";
import { useToast } from "@/components/ui/Toast";
import { GenerationControl } from "@/features/content/GenerationControl";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <p className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
        {title}
      </p>
      {children}
    </section>
  );
}

export function Gallery({
  theme,
  generation,
}: {
  theme: "dark" | "light";
  generation?: "auto" | "manual";
}) {
  const toast = useToast();
  const [chips, setChips] = useState<string[]>(["Instagram"]);
  const [scope, setScope] = useState<"month" | "quarter" | "all">("month");
  const [posted, setPosted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [steer, setSteer] = useState("");

  return (
    <div data-theme={theme} className="min-h-dvh bg-canvas text-primary">
      <main className="mx-auto flex max-w-(--container-content) flex-col gap-8 px-5 py-8 pb-24">
        <h1 className="font-display text-h1 font-semibold tracking-h1">
          Design system
        </h1>

        <Section title="Buttons">
          {VARIANTS.map((variant) => (
            <div key={variant} className="flex flex-wrap gap-3">
              <Button variant={variant}>{variant}</Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
              <Button variant={variant} loading>
                Loading
              </Button>
            </div>
          ))}
          <div className="flex gap-3">
            <Button variant="icon" aria-label="Settings">
              <Icon name="settings" />
            </Button>
            <Button variant="icon" aria-label="Refresh" disabled>
              <Icon name="refresh" />
            </Button>
          </div>
          <Button size="action" className="w-full">
            Mark as posted
          </Button>
        </Section>

        {generation ? (
          <Section title="Generation examples">
            <GenerationControl
              enabled
              auto={generation === "auto"}
              target={{
                kind: "hydrate",
                itemId: "00000000-0000-4000-8000-000000000001",
              }}
            />
            <GenerationControl
              enabled
              target={{
                kind: "regenerate",
                itemId: "00000000-0000-4000-8000-000000000001",
              }}
            />
            <GenerationControl
              enabled
              target={{ kind: "month", month: "2026-12" }}
            />
          </Section>
        ) : null}

        <Section title="Chips">
          <div className="flex flex-wrap gap-3">
            {["Instagram", "LinkedIn", "WhatsApp"].map((label) => (
              <Chip
                key={label}
                selected={chips.includes(label)}
                onClick={() =>
                  setChips((current) =>
                    current.includes(label)
                      ? current.filter((chip) => chip !== label)
                      : [...current, label],
                  )
                }
              >
                {label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl
            label="Archive scope"
            value={scope}
            onChange={setScope}
            segments={[
              { value: "month", label: "Month" },
              { value: "quarter", label: "Quarter" },
              { value: "all", label: "All" },
            ]}
          />
        </Section>

        <Section title="Inputs">
          <Input
            label="Brand name"
            placeholder="Apexoria Learning"
            helper="Used in every piece of content we generate."
          />
          <Input
            label="Website"
            defaultValue="not a url"
            error="Enter a full web address."
          />
          <Textarea
            label="Steer"
            placeholder="Make it funnier"
            value={steer}
            onChange={(event) => setSteer(event.target.value)}
          />
        </Section>

        <Section title="Status">
          <div className="flex items-center gap-6">
            <StatusTick
              hook="Five resume myths"
              checked={posted}
              onCheckedChange={setPosted}
            />
            <ProgressRing posted={posted ? 13 : 12} planned={30} />
          </div>
        </Section>

        <Section title="Skeleton">
          <Skeleton className="h-40 w-full rounded-xl" />
        </Section>

        <Section title="Banners">
          <Banner variant="accent" progress>
            Planning next month…
          </Banner>
          <Banner variant="neutral" onDismiss={() => undefined}>
            You&apos;re offline.
          </Banner>
          <Banner
            variant="danger"
            action={{ label: "Try again", onAction: () => undefined }}
          >
            Generation didn&apos;t complete. Nothing was changed.
          </Banner>
        </Section>

        <Section title="States">
          <EmptyState
            glyph="calendar-plus"
            statement="No content planned for today."
            guidance="Generate a plan and you'll have something to post in under a minute."
            action={{
              label: "Generate today's content",
              onAction: () => undefined,
            }}
          />
          <ErrorState
            statement="We couldn't load this list."
            onRetry={() => undefined}
          />
        </Section>

        <Section title="Overlays">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open sheet
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.show({
                  message: "Marked as posted.",
                  action: { label: "Undo", onAction: () => undefined },
                })
              }
            >
              Show toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.show({
                  message: "Couldn't save that — we've put it back.",
                  tone: "error",
                })
              }
            >
              Show error toast
            </Button>
          </div>
        </Section>

        <Section title="Icons">
          <ul className="grid grid-cols-6 gap-4 text-secondary">
            {ICON_NAMES.map((name) => (
              <li key={name} className="flex justify-center">
                <Icon name={name} label={name} />
              </li>
            ))}
          </ul>
        </Section>
      </main>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Regenerate"
      >
        <div className="flex flex-col gap-4">
          <Input label="Steer" placeholder="Focus on Flow" />
          <Button onClick={() => setSheetOpen(false)}>Regenerate</Button>
        </div>
      </BottomSheet>
    </div>
  );
}
