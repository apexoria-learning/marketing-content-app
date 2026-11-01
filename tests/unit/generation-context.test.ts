import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import type { Database } from "../../src/server/db/database.types";
vi.mock("server-only", () => ({}));
import { loadGenerationContext } from "../../src/server/services/generation-context";

it("includes every posted idea in the 60-day window without leaking brand audit fields", async () => {
  const pages: string[] = [];
  const client = createClient<Database>(
    "https://example.test",
    "test-anon-key",
    {
      auth: { persistSession: false },
      global: {
        fetch: async (input) => {
          const url = new URL(String(input));
          let result: unknown = [];
          if (url.pathname.endsWith("/brand_profile")) {
            result = {
              business_name: "Apexoria",
              business_description: "Training",
              audience_description: "Learners",
              courses: [],
              current_offers: null,
              tone_instagram: "Helpful",
              tone_linkedin: "Helpful",
              tone_whatsapp: "Helpful",
              do_list: [],
              dont_list: [],
              links: {},
              updated_by: "private@example.test",
            };
          } else if (url.searchParams.get("select") === "idea") {
            pages.push(url.searchParams.get("offset") ?? "0");
            result =
              pages.length === 1
                ? Array.from({ length: 500 }, (_, index) => ({
                    idea: `Old idea ${index}`,
                  }))
                : [{ idea: "The last idea" }];
            expect(url.searchParams.get("posted_at")).toBe(
              "gte.2026-09-02T00:00:00+05:30",
            );
          }
          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    },
  );
  const context = await loadGenerationContext(
    client,
    {
      platform: "instagram",
      format: "post",
      pillar: "salesforce_tips",
      idea: "Plan",
    },
    "2026-11-01",
  );
  expect(pages).toEqual(["0", "500"]);
  expect(context.recent_ideas).toHaveLength(501);
  expect(context.recent_ideas.at(-1)).toBe("The last idea");
  expect(JSON.stringify(context)).not.toContain("private@example.test");
});
