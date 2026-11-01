import type { DailyTip } from "@/lib/schemas/content";
export function TipCard({
  tip,
  isFallback = false,
}: {
  tip: DailyTip | null;
  isFallback?: boolean;
}) {
  return (
    <aside
      aria-label="Marketing tip"
      className="rounded-lg border-l-2 border-accent bg-surface-sunken p-6"
    >
      <h2 className="text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
        {isFallback ? "Recent marketing tip" : "Tip of the day"}
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-body font-medium text-primary">
        {tip?.tip ??
          "No marketing tip is available yet. Tips will arrive when daily generation is enabled."}
      </p>
    </aside>
  );
}
