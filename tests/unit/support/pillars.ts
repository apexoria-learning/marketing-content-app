import type { PillarDisplay } from "../../../src/lib/schemas/pillars";
import type { PlannablePillar } from "../../../src/lib/utils/planning-rules";

// Mirrors the pillar seed in supabase/migrations/0017_pillar_catalogue.sql.
const SEED: readonly (readonly [string, string, string, boolean])[] = [
  ["salesforce_tips", "Tips", "Teach something small and useful", false],
  ["salesforce_news", "News", "Releases, features, deprecations", true],
  ["memes", "Meme", "Relatable humour, reach driver", false],
  ["interview_questions", "Interview", "Interview prep value", false],
  ["success_stories", "Success", "Placement and student wins", false],
  ["course_promos", "Promo", "Batch launches, offers", false],
  ["career_guidance", "Career", "Advice for freshers/switchers", false],
  ["behind_the_scenes", "BTS", "Trainer POV, classroom moments", false],
  ["myth_busting", "Myths", "Correct common misconceptions", false],
  ["polls_engagement", "Poll", "Deliberate engagement bait", false],
];

export const SEEDED_PILLARS: readonly PlannablePillar[] = SEED.map(
  ([key, label, description, requires_news]) => ({
    key,
    label,
    description,
    guidance: "",
    requires_news,
  }),
);

export const PILLAR_KEYS = SEEDED_PILLARS.map((pillar) => pillar.key);

export function pillarRulesFor(key: string) {
  const pillar = SEEDED_PILLARS.find((entry) => entry.key === key);
  if (!pillar) throw new Error(`Unknown test pillar ${key}`);
  return {
    label: pillar.label,
    description: pillar.description,
    guidance: pillar.guidance,
    requires_news: pillar.requires_news,
  };
}

export function pillarsWith(keys: readonly string[]): PlannablePillar[] {
  return SEEDED_PILLARS.filter((pillar) => keys.includes(pillar.key));
}

export const SEEDED_PILLAR_DISPLAYS: PillarDisplay[] = SEEDED_PILLARS.map(
  (pillar) => ({
    key: pillar.key,
    label: pillar.label,
    is_enabled: true,
    requires_news: pillar.requires_news,
  }),
);
