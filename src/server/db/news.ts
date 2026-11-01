import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "./database.types";

export function createNewsRepository(database: SupabaseClient<Database>) {
  return {
    async upsert(articles: TablesInsert<"news_items">[]) {
      if (!articles.length) return;
      const unique = [
        ...new Map(
          articles.map((article) => [article.url_hash, article]),
        ).values(),
      ];
      const { error } = await database
        .from("news_items")
        .upsert(unique, { onConflict: "url_hash", ignoreDuplicates: true });
      if (error) throw error;
    },
    async prune(before: string) {
      const { error } = await database
        .from("news_items")
        .delete()
        .lt("fetched_at", before);
      if (error) throw error;
    },
    async record(result: {
      status: "success" | "failed";
      items_processed: number;
      error: string | null;
      started_at: string;
    }) {
      const { error } = await database.from("generation_runs").insert({
        kind: "news_ingest",
        ...result,
        finished_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
  };
}
