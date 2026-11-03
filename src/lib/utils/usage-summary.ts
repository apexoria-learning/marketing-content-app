import { z } from "zod";
import { shiftDate, todayInIst } from "./dates";

export const UsageRunSchema = z.object({
  started_at: z.string(),
  kind: z.string(),
  status: z.string(),
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  actor_email: z.string().nullable(),
});
export type UsageRun = z.infer<typeof UsageRunSchema>;

export type UsageTotals = {
  runs: number;
  failed: number;
  input_tokens: number;
  output_tokens: number;
};

export type UsageSummary = {
  window_days: number;
  totals: UsageTotals;
  today: UsageTotals;
  /** Days with at least one run, newest first. */
  by_day: ({ date: string } & UsageTotals)[];
  /** Highest token use first; `null` is a scheduled or pre-attribution run. */
  by_user: ({ email: string | null } & UsageTotals)[];
  by_kind: ({ kind: string } & UsageTotals)[];
};

export const USAGE_WINDOW_DAYS = 30;

/** First instant (IST midnight) of a usage window ending today. */
export function usageWindowStart(
  now = new Date(),
  windowDays = USAGE_WINDOW_DAYS,
): string {
  return `${shiftDate(todayInIst(now), -(windowDays - 1))}T00:00:00+05:30`;
}

function emptyTotals(): UsageTotals {
  return { runs: 0, failed: 0, input_tokens: 0, output_tokens: 0 };
}

function add(totals: UsageTotals, run: UsageRun) {
  totals.runs += 1;
  totals.failed += run.status === "failed" ? 1 : 0;
  totals.input_tokens += run.input_tokens ?? 0;
  totals.output_tokens += run.output_tokens ?? 0;
}

function tokens(totals: UsageTotals) {
  return totals.input_tokens + totals.output_tokens;
}

function addTo<K>(map: Map<K, UsageTotals>, key: K, run: UsageRun) {
  const entry = map.get(key) ?? emptyTotals();
  add(entry, run);
  map.set(key, entry);
}

export function summarizeUsage(
  runs: readonly UsageRun[],
  now = new Date(),
  windowDays = USAGE_WINDOW_DAYS,
): UsageSummary {
  const today = todayInIst(now);
  const firstDay = shiftDate(today, -(windowDays - 1));
  const totals = emptyTotals();
  const todayTotals = emptyTotals();
  const days = new Map<string, UsageTotals>();
  const users = new Map<string | null, UsageTotals>();
  const kinds = new Map<string, UsageTotals>();
  for (const run of runs) {
    const date = todayInIst(new Date(run.started_at));
    if (date < firstDay || date > today) continue;
    const email = run.actor_email?.toLowerCase() ?? null;
    add(totals, run);
    if (date === today) add(todayTotals, run);
    addTo(days, date, run);
    addTo(users, email, run);
    addTo(kinds, run.kind, run);
  }
  return {
    window_days: windowDays,
    totals,
    today: todayTotals,
    by_day: [...days]
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    by_user: [...users]
      .map(([email, value]) => ({ email, ...value }))
      .sort((a, b) => tokens(b) - tokens(a) || b.runs - a.runs),
    by_kind: [...kinds]
      .map(([kind, value]) => ({ kind, ...value }))
      .sort((a, b) => tokens(b) - tokens(a) || b.runs - a.runs),
  };
}
