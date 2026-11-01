import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PillarSchema } from "../../src/lib/schemas/content";
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
import { planMonth } from "../../src/server/services/planning";
import type { GenerationContext } from "../../src/server/ai/schemas";

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
};
function validPlan(): { items: PlannedSlot[] } {
  return {
    items: Array.from({ length: 30 }, (_, index) => ({
      scheduled_date: `2026-11-${String(index + 1).padStart(2, "0")}`,
      slot: 1,
      platform: "instagram",
      format: index % 2 === 0 ? "carousel" : "post",
      pillar: PillarSchema.options[index % 10] ?? "salesforce_tips",
      idea: `Topic number ${index + 1}`,
    })),
  };
}
const input = { month: "2026-11", today: "2026-11-01", horizonMonths: 2 };

describe("deterministic planning rules", () => {
  it("accepts complete valid months and returns chronological slots", () => {
    const plan = validPlan();
    plan.items.reverse();
    const result = validatePlanningRules("2026-11", plan, []);
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
    const result = validatePlanningRules("2026-11", plan, []);
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
    const result = validatePlanningRules("2026-11", plan, []);
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
      ).violations,
    ).toContain("slot: duplicate 2026-11-01:1");
    plan.items = plan.items.slice(1);
    plan.items.push({ ...first, scheduled_date: "2026-12-01" });
    const result = validatePlanningRules("2026-11", plan, []);
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
    const result = validatePlanningRules("2026-11", plan, [
      "Salesforce FLOWS automate tasks!",
    ]);
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
    const pillars = PillarSchema.options.filter(
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
      validatePlanningRules("2026-11", validPlan(), [], false).violations.some(
        (issue) => issue.includes("news is unavailable"),
      ),
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
