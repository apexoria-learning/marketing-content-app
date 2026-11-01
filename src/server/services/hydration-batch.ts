import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";
import { ActionFailure } from "./service-error";
import { generateContentItemWithClient } from "./content-generation";

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
    } catch (failure) {
      console.error("Batch content hydration failed.");
      if (!(
        failure instanceof ActionFailure && failure.code === "GENERATION_FAILED"
      ))
        throw failure;
      await dependencies.recordFailure(
        row.id,
        "Content generation did not complete.",
      );
      failed++;
    }
  }
  return { completed, failed, attempted, remaining: rows.length - attempted };
}

export async function hydratePendingContent(
  client: SupabaseClient<Database>,
  options: Parameters<typeof hydrateBatch>[1] = {},
) {
  return hydrateBatch(
    {
      async listIdeas(limit) {
        const { data, error } = await client
          .from("content_items")
          .select("id")
          .eq("status", "idea")
          .is("hydrated_at", null)
          .order("scheduled_date")
          .order("slot")
          .limit(limit);
        if (error) throw error;
        return z.array(z.object({ id: z.uuid() })).parse(data);
      },
      async hydrate(id, signal) {
        await generateContentItemWithClient(
          client,
          id,
          false,
          undefined,
          signal,
        );
      },
      async recordFailure(id, message) {
        const { error } = await client
          .from("content_items")
          .update({ generation_error: message })
          .eq("id", id)
          .eq("status", "idea")
          .is("hydrated_at", null);
        if (error) throw error;
      },
    },
    options,
  );
}
