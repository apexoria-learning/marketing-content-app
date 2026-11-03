"use client";

import { usePillarDisplay } from "./PillarCatalogue";

export function PillarChip({ pillar }: { pillar: string }) {
  return (
    <span className="e2 inline-flex max-w-full rounded-pill px-3 py-1 text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
      {usePillarDisplay(pillar).label}
    </span>
  );
}

/** The pillar's catalogue label as plain text, for rows and summaries. */
export function PillarName({ pillar }: { pillar: string }) {
  return <>{usePillarDisplay(pillar).label}</>;
}
