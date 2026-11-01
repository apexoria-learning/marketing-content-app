import type { DesignBrief } from "@/lib/schemas/content";
export function BriefSection({ brief }: { brief: DesignBrief }) {
  return (
    <section className="space-y-4" aria-label="Design brief">
      <h2 className="font-display text-h2 font-semibold">Design brief</h2>
      {(
        [
          ["Objective", brief.objective],
          ["Visual direction", brief.visual_direction],
          ["Layout notes", brief.layout_notes],
          ["Typography", brief.typography],
        ] as const
      ).map(([label, text]) => (
        <div key={label}>
          <h3 className="text-h3 font-semibold">{label}</h3>
          <p className="whitespace-pre-wrap text-body text-secondary">{text}</p>
        </div>
      ))}
      {(
        [
          ["Must include", brief.must_include, "+"],
          ["Must avoid", brief.must_avoid, "-"],
        ] as const
      ).map(([label, values, prefix]) => (
        <div key={label}>
          <h3 className="text-h3 font-semibold">{label}</h3>
          <ul>
            {values.map((value, index) => (
              <li key={index} className="text-body text-secondary">
                {prefix} {value}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <h3 className="text-h3 font-semibold">Specs</h3>
        <dl className="text-body font-mono text-secondary">
          {Object.entries(brief.specs)
            .filter(([, value]) => value !== null)
            .map(([key, value]) => (
              <div key={key} className="flex flex-wrap gap-2">
                <dt>{key.replaceAll("_", " ")}:</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      </div>
    </section>
  );
}
