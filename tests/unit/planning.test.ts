import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  PILLAR_KEYS,
  SEEDED_PILLARS,
  pillarRulesFor,
  pillarsWith,
} from "./support/pillars";
import {
  PlanMonthInputSchema,
  type PlannedSlot,
} from "../../src/lib/schemas/planning";
import {
  areSimilarIdeas,
  isMonthWithinHorizon,
  validatePlanningRules,
} from "../../src/lib/utils/planning-rules";
import { generateMonthPlan } from "../../src/server/ai/generators/month-plan";
import { generateDayPlan } from "../../src/server/ai/generators/day-plan";
import { AiOutputError } from "../../src/server/ai/validation";
import { planMonth } from "../../src/server/services/planning";
import { buildContentPrompt } from "../../src/server/ai/prompts";
import type { GenerationContext } from "../../src/server/ai/schemas";
import type { PlanningFilters } from "../../src/lib/utils/planning-rules";

// Today's three catalogue platforms (migration 0016 seed) and every pillar.
const seeded: PlanningFilters = {
  platforms: [
    {
      key: "instagram",
      formats: ["carousel", "reel", "post", "story", "meme", "poll"],
    },
    { key: "linkedin", formats: ["carousel", "post", "poll"] },
    { key: "whatsapp", formats: ["story", "meme"] },
  ],
  pillars: SEEDED_PILLARS,
};

const context: GenerationContext = {
  platform: "instagram",
  format: "post",
  pillar: "salesforce_tips",
  idea: "Plan",
  brand: {
    business_name: "Apexoria",
    business_description: "Salesforce training",
    audience_description: "Learners",
    courses: [],
    current_offers: null,
    tone: "Helpful",
    do_list: [],
    dont_list: [],
    links: {},
  },
  news: [
    {
      title: "News",
      source: "Publisher",
      url: "https://example.test/news",
      summary: null,
    },
  ],
  recent_ideas: [],
  pillar_history: [],
  platform_rules: {
    label: "Instagram",
    allows_hashtags: true,
    max_hashtags: 30,
    caption_max_chars: null,
    guidance: "",
  },
  pillar_rules: pillarRulesFor("salesforce_tips"),
};
function validPlan(): { items: PlannedSlot[] } {
  return {
    items: Array.from({ length: 30 }, (_, index) => ({
      scheduled_date: `2026-11-${String(index + 1).padStart(2, "0")}`,
      slot: 1,
      platform: "instagram",
      format: index % 2 === 0 ? "carousel" : "post",
      pillar: PILLAR_KEYS[index % 10] ?? "salesforce_tips",
      idea: `Topic number ${index + 1}`,
    })),
  };
}
const input = {
  month: "2026-11",
  today: "2026-11-01",
  horizonMonths: 2,
  filters: seeded,
};

describe("day planning", () => {
  const slot: PlannedSlot = {
    scheduled_date: "2026-11-01",
    slot: 1,
    platform: "instagram",
    format: "post",
    pillar: "salesforce_tips",
    idea: "Flow debugging walkthrough",
  };
  it("accepts one validated skeleton without transport retries", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue({ content: JSON.stringify({ items: [slot] }) });
    expect(
      await generateDayPlan(
        { date: slot.scheduled_date, count: 1, context, filters: seeded },
        generate,
      ),
    ).toEqual({ items: [slot], prompt_version: "day-plan-v2" });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("repairs malformed output once and rejects persistent failures", async () => {
    const generate = vi.fn().mockResolvedValue({ content: "not JSON" });
    await expect(
      generateDayPlan(
        { date: slot.scheduled_date, count: 1, context, filters: seeded },
        generate,
      ),
    ).rejects.toThrow(AiOutputError);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("rejects invented news, repeated ideas, wrong dates and adjacent formats", async () => {
    for (const invalid of [
      { ...slot, pillar: "salesforce_news" },
      { ...slot, scheduled_date: "2026-11-02" },
      { ...slot, idea: "Already posted" },
      slot,
    ]) {
      const generate = vi
        .fn()
        .mockResolvedValue({ content: JSON.stringify({ items: [invalid] }) });
      await expect(
        generateDayPlan(
          {
            date: slot.scheduled_date,
            count: 1,
            context: { ...context, news: [], recent_ideas: ["already posted"] },
            filters: seeded,
            adjacentSlots: [{ pillar: "career_guidance", format: "post" }],
          },
          generate,
        ),
      ).rejects.toThrow();
      expect(generate).toHaveBeenCalledTimes(2);
    }
  });
});

describe("deterministic planning rules", () => {
  it("accepts complete valid months and returns chronological slots", () => {
    const plan = validPlan();
    plan.items.reverse();
    const result = validatePlanningRules("2026-11", plan, [], seeded);
    expect(result.violations).toEqual([]);
    expect(result.items[0]?.scheduled_date).toBe("2026-11-01");
  });

  it("checks the exact 0.70 similarity boundary, normalization and distinct ideas", () => {
    expect(areSimilarIdeas("a b c d e f g", "a b c d e f g h i j")).toBe(true);
    expect(areSimilarIdeas("a b c d e f", "a b c d e f g h i j")).toBe(false);
    expect(areSimilarIdeas("Salesforce: FLOWS!", "salesforce flows")).toBe(
      true,
    );
    expect(areSimilarIdeas("Flows automate tasks", "Apex class testing")).toBe(
      false,
    );
    expect(areSimilarIdeas("!!!", "???")).toBe(false);
  });

  it("rejects repeated pillars on adjacent dates and a pillar appearing once", () => {
    const plan = validPlan();
    const first = plan.items[0];
    const second = plan.items[1];
    if (!first || !second) throw new Error("Fixture missing");
    second.pillar = first.pillar;
    for (const item of plan.items)
      if (item.pillar === "salesforce_news") item.pillar = "memes";
    const result = validatePlanningRules("2026-11", plan, [], seeded);
    expect(
      result.violations.some((issue) =>
        issue.includes("consecutive day repeat"),
      ),
    ).toBe(true);
    expect(result.violations).toContain(
      "pillar: salesforce_news must appear at least twice",
    );
  });

  it("rejects consecutive same-platform formats and incompatible formats", () => {
    const plan = validPlan();
    const second = plan.items[1];
    const third = plan.items[2];
    if (!second || !third) throw new Error("Fixture missing");
    second.format = "carousel";
    third.platform = "whatsapp";
    const result = validatePlanningRules("2026-11", plan, [], seeded);
    expect(result.violations).toContain(
      "format: consecutive day repeat on 2026-11-02",
    );
    expect(result.violations).toContain(
      "format: incompatible platform on 2026-11-03",
    );
  });

  it("rejects third slots, duplicate slots, missing days and outside-month dates", () => {
    const plan = validPlan();
    expect(
      validatePlanningRules(
        "2026-11",
        {
          items: [...plan.items, { ...plan.items[0], slot: 3 }],
        },
        [],
        seeded,
      ).violations.length,
    ).toBeGreaterThan(0);
    const first = plan.items[0];
    if (!first) throw new Error("Fixture missing");
    expect(
      validatePlanningRules(
        "2026-11",
        {
          items: [...plan.items, first],
        },
        [],
        seeded,
      ).violations,
    ).toContain("slot: duplicate 2026-11-01:1");
    plan.items = plan.items.slice(1);
    plan.items.push({ ...first, scheduled_date: "2026-12-01" });
    const result = validatePlanningRules("2026-11", plan, [], seeded);
    expect(result.violations).toContain("date: 2026-11-01 has no content");
    expect(result.violations).toContain(
      "date: 2026-12-01 is outside the requested month",
    );
  });

  it("rejects recent posted near-duplicates and non-starting lone slots", () => {
    const plan = validPlan();
    const first = plan.items[0];
    if (!first) throw new Error("Fixture missing");
    first.idea = "Salesforce flows automate tasks";
    first.slot = 2;
    const result = validatePlanningRules(
      "2026-11",
      plan,
      ["Salesforce FLOWS automate tasks!"],
      seeded,
    );
    expect(result.violations).toContain(
      "idea: near-duplicate of a recent post on 2026-11-01",
    );
    expect(result.violations).toContain(
      "slot: 2026-11-01 must start at slot 1",
    );
  });

  it("checks month horizons across years and rejects malformed months", () => {
    expect(isMonthWithinHorizon("2027-01", "2026-11-01", 2)).toBe(true);
    expect(isMonthWithinHorizon("2027-02", "2026-11-01", 2)).toBe(false);
    expect(isMonthWithinHorizon("2026-10", "2026-11-01", 2)).toBe(false);
    expect(isMonthWithinHorizon("2026-13", "2026-11-01", 2)).toBe(false);
    expect(PlanMonthInputSchema.safeParse({ month: "0000-01" }).success).toBe(
      false,
    );
  });
});

describe("month generation pipeline", () => {
  it("rejects brief-style ideas from the live failure and repairs once to one-line ideas", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const verbose = validPlan();
    const first = verbose.items[0];
    if (!first) throw new Error("Fixture missing");
    // Shape observed in the truncated live reply: a hook plus slide-by-slide copy.
    first.idea =
      "Hook: 'SOQL in a loop?' 5-slide carousel. Slide 1 shows the bad pattern, a SOQL query inside a for loop. Slide 2 explains the governor limit. Slide 3 shows the fix: query once outside the loop. Slide 4 shows a Map.";
    expect(
      validatePlanningRules("2026-11", verbose, [], seeded).violations.length,
    ).toBeGreaterThan(0);
    expect(
      validatePlanningRules(
        "2026-11",
        {
          items: verbose.items.map((item, index) =>
            index === 0 ? { ...item, idea: "Line one\nLine two" } : item,
          ),
        },
        [],
        seeded,
      ).violations.length,
    ).toBeGreaterThan(0);
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ content: JSON.stringify(verbose) })
      .mockResolvedValueOnce({ content: JSON.stringify(validPlan()) });
    const result = await generateMonthPlan({ ...input, context }, generate);
    expect(result.items).toHaveLength(30);
    expect(generate).toHaveBeenCalledTimes(2);
    const instructions = JSON.stringify(generate.mock.calls[0]?.[0].messages);
    expect(instructions).toContain("ONE line of at most 200 characters");
    expect(instructions).toContain('\\"maxLength\\":200');
  });

  it("makes one deterministic request for a valid month", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue({ content: JSON.stringify(validPlan()) });
    const result = await generateMonthPlan({ ...input, context }, generate);
    expect(result.items).toHaveLength(30);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0].messages[0].content).toContain(
      "Apexoria",
    );
  });

  it("repairs once naming violations and rejects persistent invalid output", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const generate = vi.fn().mockResolvedValue({ content: "{}" });
    await expect(
      generateMonthPlan({ ...input, context }, generate),
    ).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].messages.at(-1).content).toContain(
      "items",
    );
  });

  it("omits news explicitly and enforces nine-pillar coverage when grounding is unavailable", async () => {
    const plan = validPlan();
    const pillars = PILLAR_KEYS.filter(
      (pillar) => pillar !== "salesforce_news",
    );
    plan.items.forEach((item, index) => {
      item.pillar = pillars[index % pillars.length] ?? "salesforce_tips";
    });
    const generate = vi
      .fn()
      .mockResolvedValue({ content: JSON.stringify(plan) });
    await expect(
      generateMonthPlan(
        {
          ...input,
          context: { ...context, news: [] },
        },
        generate,
      ),
    ).resolves.toMatchObject({ news_omitted: true });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(
      validatePlanningRules(
        "2026-11",
        validPlan(),
        [],
        seeded,
        false,
      ).violations.some((issue) => issue.includes("news is unavailable")),
    ).toBe(true);
  });

  it("rejects invalid horizon before any AI call", async () => {
    const generate = vi.fn();
    await expect(
      generateMonthPlan(
        {
          ...input,
          month: "2027-02",
          context,
        },
        generate,
      ),
    ).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
  });

  it("never commits invalid plans and commits valid plans in one adapter call", async () => {
    const commitPlan = vi
      .fn()
      .mockResolvedValue({ plan_id: "plan", item_count: 30 });
    const generate = vi.fn().mockResolvedValue({ content: "{}" });
    const dependencies = {
      exists: vi.fn().mockResolvedValue(false),
      loadContext: vi.fn().mockResolvedValue(context),
      generate,
      commitPlan,
    };
    await expect(planMonth(input, dependencies)).rejects.toThrow();
    expect(commitPlan).not.toHaveBeenCalled();
    generate.mockResolvedValue({ content: JSON.stringify(validPlan()) });
    await expect(planMonth(input, dependencies)).resolves.toEqual({
      plan_id: "plan",
      item_count: 30,
    });
    expect(commitPlan).toHaveBeenCalledTimes(1);
    expect(commitPlan.mock.calls[0]?.[0].items).toHaveLength(30);
  });

  it("rejects already-planned months without any AI or persistence call", async () => {
    const generate = vi.fn();
    const commitPlan = vi.fn();
    await expect(
      planMonth(input, {
        exists: vi.fn().mockResolvedValue(true),
        loadContext: vi.fn(),
        generate,
        commitPlan,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(generate).not.toHaveBeenCalled();
    expect(commitPlan).not.toHaveBeenCalled();
  });
});

describe("admin planning filters and editorial instructions", () => {
  const threePillars = ["salesforce_tips", "memes", "career_guidance"] as const;
  function filteredPlan() {
    const plan = validPlan();
    plan.items.forEach((item, index) => {
      item.pillar = threePillars[index % 3] ?? "salesforce_tips";
    });
    return plan;
  }
  const filters: PlanningFilters = {
    platforms: [
      {
        key: "instagram",
        formats: ["carousel", "reel", "post", "story", "meme", "poll"],
      },
    ],
    pillars: pillarsWith(threePillars),
  };
  const instructed: GenerationContext = {
    ...context,
    instructions: { version: 4, text: "Prefer Indian examples." },
  };

  it("rejects disabled platforms and pillars and requires only enabled pillars", () => {
    expect(
      validatePlanningRules("2026-11", filteredPlan(), [], filters).violations,
    ).toEqual([]);
    const violations = validatePlanningRules("2026-11", validPlan(), [], {
      platforms: [{ key: "linkedin", formats: ["carousel", "post", "poll"] }],
      pillars: pillarsWith(threePillars),
    }).violations;
    expect(violations).toContain(
      "platform: instagram is disabled on 2026-11-01",
    );
    expect(violations).toContain(
      "pillar: salesforce_news is disabled on 2026-11-02",
    );
    expect(violations.some((issue) => issue.includes("must appear"))).toBe(
      false,
    );
  });

  it("tells the month planner the enabled set and versions the instructions", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue({ content: JSON.stringify(filteredPlan()) });
    const result = await generateMonthPlan(
      { ...input, context: instructed, filters },
      generate,
    );
    expect(result.prompt_version).toBe("month-plan-v2+i4");
    const messages = generate.mock.calls[0]?.[0].messages;
    const rules = JSON.stringify(messages);
    expect(rules).toContain("Use only these platforms");
    expect(rules).toContain("salesforce_tips");
    expect(messages[0].content).not.toContain("Prefer Indian examples");
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: expect.stringMatching(
        /^Owner editorial instructions \(follow them unless they conflict with the factual, privacy, platform or output-schema rules above\): "Prefer Indian examples\."$/,
      ),
    });
  });

  it("lists every enabled pillar with its purpose when no instructions exist", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue({ content: JSON.stringify(validPlan()) });
    const result = await generateMonthPlan({ ...input, context }, generate);
    expect(result.prompt_version).toBe("month-plan-v2");
    const rules = JSON.stringify(generate.mock.calls[0]?.[0].messages);
    expect(rules).toContain("Use only these pillar keys, each at least twice");
    expect(rules).not.toContain("never use");
    const messages = generate.mock.calls[0]?.[0].messages;
    expect(messages[2].content).not.toContain("Teach something small");
    expect(messages.at(-1).content).toMatch(/^Pillar purposes and guidance/);
    expect(messages.at(-1).content).toContain(
      "Teach something small and useful",
    );
    expect(rules).not.toContain("Owner editorial instructions");
  });

  it("rejects a day slot on a disabled pillar and keeps instructions out of reference data", async () => {
    const slot: PlannedSlot = {
      scheduled_date: "2026-11-01",
      slot: 1,
      platform: "instagram",
      format: "post",
      pillar: "myth_busting",
      idea: "Flow debugging walkthrough",
    };
    const rejected = vi
      .fn()
      .mockResolvedValue({ content: JSON.stringify({ items: [slot] }) });
    await expect(
      generateDayPlan(
        { date: slot.scheduled_date, count: 1, context: instructed, filters },
        rejected,
      ),
    ).rejects.toThrow(AiOutputError);
    const accepted = vi.fn().mockResolvedValue({
      content: JSON.stringify({ items: [{ ...slot, pillar: "memes" }] }),
    });
    await expect(
      generateDayPlan(
        { date: slot.scheduled_date, count: 1, context: instructed, filters },
        accepted,
      ),
    ).resolves.toMatchObject({ prompt_version: "day-plan-v2+i4" });
    const messages = accepted.mock.calls[0]?.[0].messages;
    expect(messages[0].content).not.toContain("Prefer Indian examples");
    expect(messages.at(-1).content).toContain("Owner editorial instructions");
  });

  it("places content instructions after the rules and before the steer", () => {
    const prompt = buildContentPrompt({ ...instructed, steer: "Be concise" });
    const contents = prompt.messages.map((message) => message.content);
    expect(contents.at(-2)).toContain("Prefer Indian examples");
    expect(contents.at(-1)).toContain("Be concise");
    expect(contents[0]).not.toContain("Prefer Indian examples");
  });
});

describe("catalogue pillars (DATABASE.md §5.14)", () => {
  const pythonNews = {
    key: "python_news",
    label: "Py news",
    description: "Python releases and PEPs",
    guidance: "",
    requires_news: true,
  };
  const pythonPillars = [
    {
      key: "python_tips",
      label: "Py tips",
      description: "Small Python lessons",
      guidance: "Always include a runnable snippet.",
      requires_news: false,
    },
    {
      key: "py_jobs",
      label: "Jobs",
      description: "Python careers",
      guidance: "",
      requires_news: false,
    },
    {
      key: "py_memes",
      label: "Memes",
      description: "Developer humour",
      guidance: "",
      requires_news: false,
    },
    pythonNews,
  ];
  const pythonFilters: PlanningFilters = {
    platforms: seeded.platforms,
    pillars: pythonPillars,
  };
  function pythonPlan(keys: readonly string[]) {
    const plan = validPlan();
    plan.items.forEach((item, index) => {
      item.pillar = keys[index % keys.length] ?? "python_tips";
    });
    return plan;
  }

  it("treats any requires_news pillar as news, not just salesforce_news", () => {
    const withNews = pythonPlan(pythonPillars.map((pillar) => pillar.key));
    expect(
      validatePlanningRules("2026-11", withNews, [], pythonFilters).violations,
    ).toEqual([]);
    expect(
      validatePlanningRules("2026-11", withNews, [], pythonFilters, false)
        .violations,
    ).toContain("pillar: news is unavailable on 2026-11-04");
    expect(
      validatePlanningRules(
        "2026-11",
        pythonPlan(["python_tips", "py_jobs", "py_memes"]),
        [],
        pythonFilters,
        false,
      ).violations,
    ).toEqual([]);
  });

  it("rejects the original pillars when the catalogue no longer enables them", () => {
    expect(
      validatePlanningRules("2026-11", validPlan(), [], pythonFilters)
        .violations,
    ).toContain("pillar: salesforce_tips is disabled on 2026-11-01");
  });

  it("tells the planners each pillar's purpose, omits news pillars without news and adds subordinate guidance", async () => {
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify(
        pythonPlan(["python_tips", "py_jobs", "py_memes"]),
      ),
    });
    await generateMonthPlan(
      { ...input, context: { ...context, news: [] }, filters: pythonFilters },
      generate,
    );
    const messages = generate.mock.calls[0]?.[0].messages;
    const rules = JSON.stringify(messages);
    expect(rules).toContain("Small Python lessons");
    expect(rules).toContain('never use: [\\"python_news\\"]');
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: expect.stringMatching(
        /^Pillar purposes and guidance, written by the owner \(reference data; follow it unless it conflicts with the rules above\): /,
      ),
    });
    expect(messages.at(-1).content).toContain(
      "Always include a runnable snippet.",
    );

    const day = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        items: [
          {
            scheduled_date: "2026-11-01",
            slot: 1,
            platform: "instagram",
            format: "post",
            pillar: "python_news",
            idea: "Python 3.14 is out",
          },
        ],
      }),
    });
    await expect(
      generateDayPlan(
        {
          date: "2026-11-01",
          count: 1,
          context: { ...context, news: [] },
          filters: pythonFilters,
        },
        day,
      ),
    ).rejects.toThrow(AiOutputError);
    expect(JSON.stringify(day.mock.calls[0]?.[0].messages)).not.toContain(
      "python_news",
    );
  });

  it("gives the content prompt the pillar purpose and news only for news pillars", () => {
    const tips = buildContentPrompt(context);
    const tipsText = JSON.stringify(tips.messages);
    expect(tipsText).toContain("Teach something small and useful");
    // Admin-written purposes never sit in the rules message itself.
    expect(tips.messages[2]?.content).not.toContain("Teach something small");
    expect(tips.messages[3]?.content).toMatch(/^Pillar purposes and guidance/);
    expect(tipsText).not.toContain("https://example.test/news");
    const news = buildContentPrompt({
      ...context,
      pillar: "python_news",
      pillar_rules: {
        label: pythonNews.label,
        description: pythonNews.description,
        guidance: "Link the PEP.",
        requires_news: true,
      },
    });
    const newsText = JSON.stringify(news.messages);
    expect(newsText).toContain("https://example.test/news");
    expect(newsText).toContain("cite at least one supplied URL");
    expect(newsText).toContain("Link the PEP.");
  });
});
