import "server-only";
import { z } from "zod";

export async function hydrateBatch(
  dependencies: {
    listIdeas: (limit: number) => Promise<{ id: string }[]>;
    hydrate: (id: string, signal: AbortSignal) => Promise<void>;
    recordFailure: (id: string, error: string) => Promise<void>;
  },
  options: {
    limit?: number;
    budgetMs?: number;
    clock?: () => number;
    signal?: AbortSignal;
  } = {},
) {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(30)
    .parse(options.limit ?? 30);
  const budget = z
    .number()
    .int()
    .min(1)
    .max(240000)
    .parse(options.budgetMs ?? 240000);
  const clock = options.clock ?? (() => performance.now());
  const deadline = clock() + budget;
  const rows = z
    .array(z.object({ id: z.uuid() }))
    .max(limit)
    .parse(await dependencies.listIdeas(limit));
  let completed = 0;
  let failed = 0;
  let attempted = 0;
  for (const row of rows) {
    const remaining = Math.floor(deadline - clock());
    if (remaining <= 0 || options.signal?.aborted) break;
    const timeout = AbortSignal.timeout(remaining);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
    attempted++;
    try {
      await dependencies.hydrate(row.id, signal);
      completed++;
    } catch {
      console.error("Batch content hydration failed.");
      await dependencies.recordFailure(
        row.id,
        "Content generation did not complete.",
      );
      failed++;
    }
  }
  return { completed, failed, attempted, remaining: rows.length - attempted };
}
