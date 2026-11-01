import type { Pillar } from "@/lib/schemas/content";
export const PILLAR_LABELS: Record<Pillar, string> = {
  salesforce_tips: "Tips",
  salesforce_news: "News",
  memes: "Meme",
  interview_questions: "Interview",
  success_stories: "Success",
  course_promos: "Promo",
  career_guidance: "Career",
  behind_the_scenes: "BTS",
  myth_busting: "Myths",
  polls_engagement: "Poll",
};
export function PillarChip({ pillar }: { pillar: Pillar }) {
  return (
    <span className="e2 inline-flex max-w-full rounded-pill px-3 py-1 text-eyebrow font-semibold tracking-eyebrow text-secondary uppercase">
      {PILLAR_LABELS[pillar]}
    </span>
  );
}
