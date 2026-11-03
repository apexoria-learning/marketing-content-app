import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import type { Database } from "../../src/server/db/database.types";
vi.mock("server-only", () => ({}));
import { loadGenerationContext } from "../../src/server/services/generation-context";

// PostgREST answers maybeSingle() with an array; one catalogue row per key.
function platformRow(url: URL) {
  const key = url.searchParams.get("key")?.replace("eq.", "");
  return [
    {
      label: key === "linkedin" ? "LinkedIn" : "Instagram",
      allows_hashtags: true,
      max_hashtags: 30,
      caption_max_chars: null,
      guidance: "",
      tone: key === "linkedin" ? "Professional" : "Helpful",
    },
  ];
}

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
          if (url.pathname.endsWith("/platforms")) {
            result = platformRow(url);
          } else if (url.pathname.endsWith("/brand_profile")) {
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

it("accepts a whole content item and keeps only its slot fields (live item-generation failure)", async () => {
  const client = createClient<Database>("https://example.test", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        const result = url.pathname.endsWith("/platforms")
          ? platformRow(url)
          : url.pathname.endsWith("/brand_profile")
            ? {
                business_name: "Apexoria",
                business_description: "Training",
                audience_description: "Learners",
                courses: [],
                current_offers: null,
                tone_instagram: "Helpful",
                tone_linkedin: "Professional",
                tone_whatsapp: "Friendly",
                do_list: [],
                dont_list: [],
                links: {},
              }
            : [];
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  // The item path passes the full row; the strict context schema used to
  // reject these extra keys with an unclassified error before any AI call.
  const item = {
    id: "c862f630-7968-4b35-b048-9b7e9183fef1",
    status: "idea",
    hook: null,
    updated_at: "2026-11-01T00:00:00Z",
    scheduled_date: "2026-11-02",
    platform: "linkedin" as const,
    format: "post" as const,
    pillar: "interview_questions" as const,
    idea: "Before vs after triggers",
  };
  const context = await loadGenerationContext(client, item, "2026-11-01");
  expect(context).toMatchObject({
    platform: "linkedin",
    format: "post",
    pillar: "interview_questions",
    idea: "Before vs after triggers",
  });
  expect(context.brand.tone).toBe("Professional");
  expect(context.platform_rules).toEqual({
    label: "LinkedIn",
    allows_hashtags: true,
    max_hashtags: 30,
    caption_max_chars: null,
    guidance: "",
  });
  expect(context).not.toHaveProperty("id");
  expect(context).not.toHaveProperty("status");
});
