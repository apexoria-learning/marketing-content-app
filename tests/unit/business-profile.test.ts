import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getBusinessProfile: vi.fn(),
  updateBusinessProfile: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({ env: {} }));
vi.mock("../../src/server/db/admin", () => db);

import {
  BusinessProfileInputSchema,
  formatLinkLines,
  parseLinkLines,
  toBusinessProfileInput,
  type BusinessProfileRecord,
} from "../../src/lib/schemas/business-profile";
import type { AdminActor } from "../../src/server/auth";
import { saveBusinessProfile } from "../../src/server/services/admin";
import { buildContentPrompt } from "../../src/server/ai/prompts";
import { generateMonthPlan } from "../../src/server/ai/generators/month-plan";
import type { GenerationContext } from "../../src/server/ai/schemas";
import { SEEDED_PILLARS, pillarRulesFor } from "./support/pillars";

const python = {
  business_name: " PyCraft Academy ",
  industry: "Python training",
  business_description: "Live Python bootcamps for career switchers.",
  audience_description: "Non-programmers who want a first developer job.",
  offerings_label: "Programs",
  offerings: ["Python Basics", "Django Web Apps"],
  current_offers: "",
  tip_topic: "Python programming",
  do_list: ["Show runnable code"],
  dont_list: ["Promise jobs"],
  links: [{ label: "Website", url: "https://pycraft.example" }],
};

describe("business profile input", () => {
  it("accepts any industry, trims text and stores an empty offer as none", () => {
    expect(BusinessProfileInputSchema.parse(python)).toMatchObject({
      business_name: "PyCraft Academy",
      current_offers: null,
    });
  });

  it.each([
    { industry: "  " },
    { offerings_label: "x".repeat(31) },
    { tip_topic: "" },
    { offerings: Array.from({ length: 41 }, (_, index) => `Course ${index}`) },
    { offerings: ["Python", "python"] },
    { do_list: ["x".repeat(201)] },
    { links: [{ label: "Site", url: "ftp://pycraft.example" }] },
    { links: [{ label: "Site", url: "https://user:pass@pycraft.example" }] },
    {
      links: [
        { label: "Site", url: "https://a.example" },
        { label: "site", url: "https://b.example" },
      ],
    },
    { updated_by: "attacker@example.test" },
    { tone_instagram: "Shout" },
  ])("rejects %j", (change) => {
    expect(
      BusinessProfileInputSchema.safeParse({ ...python, ...change }).success,
    ).toBe(false);
  });

  it("reports partly typed links as errors instead of throwing", () => {
    for (const url of ["W", "h", "nope", "https://"])
      expect(
        BusinessProfileInputSchema.safeParse({
          ...python,
          links: [{ label: "Website", url }],
        }).success,
      ).toBe(false);
    expect(() =>
      BusinessProfileInputSchema.safeParse({
        ...python,
        links: parseLinkLines("Website: h"),
      }),
    ).not.toThrow();
  });

  it("round-trips links through the one-per-line editor", () => {
    const text = formatLinkLines(python.links);
    expect(text).toBe("Website: https://pycraft.example");
    expect(
      parseLinkLines(`${text}\n\n  Courses:  https://pycraft.example/c `),
    ).toEqual([
      { label: "Website", url: "https://pycraft.example" },
      { label: "Courses", url: "https://pycraft.example/c" },
    ]);
    // A line without a name is kept so validation can explain it.
    expect(parseLinkLines("https://pycraft.example")).toEqual([
      { label: "", url: "https://pycraft.example" },
    ]);
  });

  it("maps the stored courses column to the offerings list", () => {
    const record: BusinessProfileRecord = {
      ...python,
      courses: python.offerings,
      current_offers: null,
      links: { Website: "https://pycraft.example" },
      updated_at: "2026-11-04T00:00:00Z",
      updated_by: null,
    };
    expect(toBusinessProfileInput(record)).toMatchObject({
      offerings: ["Python Basics", "Django Web Apps"],
      current_offers: "",
      links: [{ label: "Website", url: "https://pycraft.example" }],
    });
  });
});

describe("saving the business profile", () => {
  it("requires an admin and attributes the change", async () => {
    db.updateBusinessProfile.mockResolvedValue({ updated_at: "t" });
    const profile = BusinessProfileInputSchema.parse(python);
    const admin = { email: "admin@example.test", isOwner: false } as AdminActor;
    await saveBusinessProfile(admin, profile);
    expect(db.updateBusinessProfile).toHaveBeenCalledWith(
      profile,
      "admin@example.test",
    );
    await expect(
      saveBusinessProfile({} as AdminActor, profile),
    ).rejects.toThrow("Admin actor is required.");
    expect(db.updateBusinessProfile).toHaveBeenCalledTimes(1);
  });
});

describe("industry-neutral prompts", () => {
  const context: GenerationContext = {
    platform: "instagram",
    format: "post",
    pillar: "python_tips",
    idea: "List comprehensions in one minute",
    brand: {
      business_name: "PyCraft Academy",
      industry: "Python training",
      business_description: python.business_description,
      audience_description: python.audience_description,
      offerings_label: "Programs",
      offerings: python.offerings,
      current_offers: null,
      tone: "Friendly",
      do_list: python.do_list,
      dont_list: python.dont_list,
      links: {},
    },
    news: [],
    recent_ideas: [],
    pillar_history: [],
    platform_rules: {
      label: "Instagram",
      allows_hashtags: true,
      max_hashtags: 5,
      caption_max_chars: null,
      guidance: "",
    },
    pillar_rules: {
      label: "Py tips",
      description: "Small Python lessons",
      guidance: "",
      requires_news: false,
    },
  };

  it("describes the business from the profile, never as Salesforce", () => {
    const prompt = JSON.stringify(buildContentPrompt(context));
    expect(prompt).not.toMatch(/salesforce/i);
    expect(prompt).toContain('\\"industry\\":\\"Python training\\"');
    expect(prompt).toContain('\\"offerings_label\\":\\"Programs\\"');
  });

  it("plans a month for another industry without Salesforce wording", async () => {
    const generate = vi.fn().mockResolvedValue({ content: "{}" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await generateMonthPlan(
      {
        month: "2026-11",
        today: "2026-11-01",
        horizonMonths: 2,
        context: {
          ...context,
          pillar: "salesforce_tips",
          pillar_rules: pillarRulesFor("salesforce_tips"),
        },
        filters: {
          platforms: [{ key: "instagram", formats: ["post", "reel"] }],
          pillars: SEEDED_PILLARS.filter((pillar) => !pillar.requires_news).map(
            (pillar) => ({ ...pillar, description: "A Python theme" }),
          ),
        },
      },
      generate,
    ).catch(() => undefined);
    const system = generate.mock.calls[0]?.[0].messages[0].content;
    expect(system).not.toMatch(/salesforce/i);
    expect(system).toContain("Python training");
  });
});
