import {
  PillarSchema,
  type ContentFormat,
  type Pillar,
} from "../schemas/content";
import {
  PlanMonthInputSchema,
  PlanOutputSchema,
  type PlannedSlot,
} from "../schemas/planning";
import { monthBounds, shiftDate, shiftMonth } from "./dates";

/** An enabled catalogue platform and the formats it supports (§5.12–5.13). */
export type PlannablePlatform = {
  key: string;
  formats: readonly ContentFormat[];
};

/** Enabled platforms (catalogue) and pillars (DATABASE.md §5.10). */
export type PlanningFilters = {
  platforms: readonly PlannablePlatform[];
  pillars: readonly Pillar[];
};

function platformOf(key: string, filters: PlanningFilters) {
  return filters.platforms.find((platform) => platform.key === key);
}

export function isCompatiblePlannedSlot(
  item: Pick<PlannedSlot, "platform" | "format">,
  filters: PlanningFilters,
) {
  return Boolean(
    platformOf(item.platform, filters)?.formats.includes(item.format),
  );
}

export function isSlotAllowedByFilters(
  item: Pick<PlannedSlot, "platform" | "pillar">,
  filters: PlanningFilters,
) {
  return (
    platformOf(item.platform, filters) !== undefined &&
    filters.pillars.includes(item.pillar)
  );
}

function words(idea: string) {
  return (
    idea
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

export function areSimilarIdeas(first: string, second: string) {
  const aWords = words(first);
  const bWords = words(second);
  if (!aWords.length || !bWords.length) return false;
  if (aWords.join(" ") === bWords.join(" ")) return true;
  const a = new Set(aWords);
  const b = new Set(bWords);
  const intersection = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;
  return intersection * 10 >= union * 7;
}

export function isMonthWithinHorizon(
  month: string,
  today: string,
  horizon: number,
) {
  const parsed = PlanMonthInputSchema.safeParse({ month });
  if (!parsed.success || !Number.isInteger(horizon) || horizon < 1)
    return false;
  const current = today.slice(0, 7);
  return month >= current && month <= shiftMonth(current, horizon);
}

export function validatePlanningRules(
  month: string,
  input: unknown,
  postedIdeas: readonly string[],
  filters: PlanningFilters,
  hasNews = true,
): { items: PlannedSlot[]; violations: string[] } {
  PlanMonthInputSchema.parse({ month });
  const parsed = PlanOutputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      items: [],
      violations: parsed.error.issues
        .slice(0, 20)
        .map((issue) => `${issue.path.join(".")}: ${issue.code}`),
    };
  }
  const items = [...parsed.data.items].sort(
    (a, b) =>
      a.scheduled_date.localeCompare(b.scheduled_date) || a.slot - b.slot,
  );
  const violations: string[] = [];
  const byDate = new Map<string, PlannedSlot[]>();
  const counts = new Map(PillarSchema.options.map((pillar) => [pillar, 0]));
  const keys = new Set<string>();
  const { start, end } = monthBounds(month);
  for (const item of items) {
    if (item.scheduled_date < start || item.scheduled_date >= end)
      violations.push(
        `date: ${item.scheduled_date} is outside the requested month`,
      );
    const key = `${item.scheduled_date}:${item.slot}`;
    if (keys.has(key)) violations.push(`slot: duplicate ${key}`);
    keys.add(key);
    const day = byDate.get(item.scheduled_date) ?? [];
    day.push(item);
    byDate.set(item.scheduled_date, day);
    counts.set(item.pillar, (counts.get(item.pillar) ?? 0) + 1);
    if (!platformOf(item.platform, filters))
      violations.push(
        `platform: ${item.platform} is disabled on ${item.scheduled_date}`,
      );
    else if (!isCompatiblePlannedSlot(item, filters))
      violations.push(
        `format: incompatible platform on ${item.scheduled_date}`,
      );
    if (postedIdeas.some((idea) => areSimilarIdeas(item.idea, idea)))
      violations.push(
        `idea: near-duplicate of a recent post on ${item.scheduled_date}`,
      );
    if (!hasNews && item.pillar === "salesforce_news")
      violations.push(`pillar: news is unavailable on ${item.scheduled_date}`);
    if (!filters.pillars.includes(item.pillar))
      violations.push(
        `pillar: ${item.pillar} is disabled on ${item.scheduled_date}`,
      );
  }
  for (let date = start; date < end; date = shiftDate(date, 1)) {
    const day = byDate.get(date) ?? [];
    if (!day.length) violations.push(`date: ${date} has no content`);
    if (day.length > 2) violations.push(`date: ${date} exceeds two items`);
    if (day.length === 1 && day[0]?.slot !== 1)
      violations.push(`slot: ${date} must start at slot 1`);
    const previous = byDate.get(shiftDate(date, -1)) ?? [];
    if (
      day.some((item) => previous.some((prior) => prior.pillar === item.pillar))
    )
      violations.push(`pillar: consecutive day repeat on ${date}`);
    if (
      day.some((item) =>
        previous.some(
          (prior) =>
            prior.platform === item.platform && prior.format === item.format,
        ),
      )
    )
      violations.push(`format: consecutive day repeat on ${date}`);
  }
  for (const [pillar, count] of counts) {
    if (!hasNews && pillar === "salesforce_news") continue;
    if (!filters.pillars.includes(pillar)) continue;
    if (count < 2)
      violations.push(`pillar: ${pillar} must appear at least twice`);
  }
  return { items, violations };
}
