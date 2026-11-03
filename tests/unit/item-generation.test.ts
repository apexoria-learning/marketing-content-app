import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { generateItem } from "../../src/server/services/item-generation";
import { ContentItemSchema } from "../../src/lib/schemas/content";
import { AiOutputError } from "../../src/server/ai/validation";

const item = ContentItemSchema.parse({
  id: "c862f630-7968-4b35-b048-9b7e9183fef1",
  plan_id: null,
  scheduled_date: "2026-11-01",
  slot: 1,
  platform: "instagram",
  format: "post",
  pillar: "salesforce_tips",
  idea: "Flows",
  title: null,
  hook: null,
  caption: null,
  hashtags: [],
  cta: null,
  body: null,
  design_brief: null,
  source_refs: [],
  status: "idea",
  posted_at: null,
  posted_by: null,
  skip_reason: null,
  regenerated_count: 0,
  prompt_version: null,
  generation_error: null,
  hydrated_at: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
});
const content = {
  title: "Flow",
  hook: "Learn flows",
  caption: "Flow basics",
  hashtags: [],
  cta: "Learn more",
  format: "post",
  body: { visual_concept: "Flow" },
  design_brief: {
    objective: "Teach",
    visual_direction: "Diagram",
    layout_notes: "Simple",
    typography: "Readable",
    must_include: [],
    must_avoid: [],
    specs: {
      dimensions: "1080x1080",
      aspect_ratio: "1:1",
      safe_area: "Inset",
      slide_count: null,
    },
  },
  source_refs: [],
};
function dependencies() {
  return {
    getItem: vi.fn().mockResolvedValue(item),
    context: vi.fn().mockResolvedValue({
      platform: item.platform,
      format: item.format,
      pillar: item.pillar,
      idea: item.idea,
      brand: {
        business_name: "Apexoria",
        business_description: "Training",
        audience_description: "Learners",
        courses: [],
        current_offers: null,
        tone: "Helpful",
        do_list: [],
        dont_list: [],
        links: {},
      },
      news: [],
      recent_ideas: [],
      pillar_history: [],
      platform_rules: {
        label: "Instagram",
        allows_hashtags: true,
        max_hashtags: 30,
        caption_max_chars: null,
        guidance: "",
      },
    }),
    generate: vi.fn().mockResolvedValue({ content: JSON.stringify(content) }),
    save: vi.fn().mockResolvedValue({ ...item, ...content }),
    recordFailure: vi.fn(),
  };
}

describe("item generation lifecycle", () => {
  it("rejects posted content without context, AI or writes", async () => {
    const deps = dependencies();
    deps.getItem.mockResolvedValue({ ...item, status: "posted" });
    await expect(
      generateItem({ itemId: item.id, regenerate: true }, deps),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });

  it("returns already-hydrated content without any AI call", async () => {
    const deps = dependencies();
    const hydrated = { ...item, ...content, hydrated_at: item.created_at };
    deps.getItem.mockResolvedValue(hydrated);
    expect(
      await generateItem({ itemId: item.id, regenerate: false }, deps),
    ).toEqual(hydrated);
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("saves only validated content with its original version and classification", async () => {
    const deps = dependencies();
    await generateItem(
      { itemId: item.id, regenerate: true, steer: "Shorter" },
      deps,
    );
    expect(deps.context).toHaveBeenCalledWith(item, "Shorter");
    expect(deps.save).toHaveBeenCalledWith({
      item,
      content,
      prompt_version: "content-v1",
      regenerate: true,
    });
  });

  it("keeps failed regeneration untouched and records only hydration failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = dependencies();
    deps.generate.mockRejectedValue(new AiOutputError(["Failure"]));
    await expect(
      generateItem({ itemId: item.id, regenerate: true }, deps),
    ).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.recordFailure).not.toHaveBeenCalled();
    await expect(
      generateItem({ itemId: item.id, regenerate: false }, deps),
    ).rejects.toThrow();
    expect(deps.recordFailure).toHaveBeenCalledWith(
      item,
      "Content generation did not complete.",
    );
  });
  it("propagates infrastructure failures without disguising them as invalid AI output", async () => {
    const deps = dependencies();
    const failure = new Error("Telemetry unavailable");
    deps.generate.mockRejectedValue(failure);
    await expect(
      generateItem({ itemId: item.id, regenerate: false }, deps),
    ).rejects.toBe(failure);
    expect(deps.recordFailure).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
});
