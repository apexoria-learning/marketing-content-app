import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildContentPrompt } from "../../src/server/ai/prompts";
import { generateContent } from "../../src/server/ai/generators";
import { validateGeneratedContent } from "../../src/server/ai/validation";
import { estimateCost } from "../../src/server/ai/accounting";
import type { GenerationContext } from "../../src/server/ai/schemas";

const context: GenerationContext = {
  platform: "instagram",
  format: "post",
  pillar: "salesforce_tips",
  idea: "Explain flows",
  brand: {
    business_name: "Apexoria",
    business_description: "Salesforce training",
    audience_description: "Learners",
    courses: ["Admin"],
    current_offers: null,
    tone: "Helpful",
    do_list: ["Be factual"],
    dont_list: ["Invent claims"],
    links: {},
  },
  news: [
    {
      title: "Verified article",
      url: "https://example.test/news",
      source: "Publisher",
      summary: null,
    },
  ],
  recent_ideas: ["Previous idea"],
  pillar_history: ["memes"],
  platform_rules: {
    label: "Instagram",
    allows_hashtags: true,
    max_hashtags: 30,
    caption_max_chars: null,
    guidance: "",
  },
};
const output = {
  format: "post",
  title: "Flows",
  hook: "Learn flows",
  caption: "First line\nSecond line",
  hashtags: ["#Salesforce"],
  cta: "Learn more",
  body: { visual_concept: "A flow diagram" },
  design_brief: {
    objective: "Teach",
    visual_direction: "Simple",
    layout_notes: "Diagram",
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

describe("generation foundation", () => {
  it("builds deterministic ordered layers with real brand context and optional steer", () => {
    const prompt = buildContentPrompt({ ...context, steer: "Be concise" });
    expect(prompt).toEqual(
      buildContentPrompt({ ...context, steer: "Be concise" }),
    );
    expect(prompt.messages).toHaveLength(4);
    expect(prompt.messages[0]?.content).toContain("Apexoria");
    expect(prompt.messages[1]?.content).toContain("Previous idea");
    expect(prompt.messages[1]?.content).not.toContain(
      "https://example.test/news",
    );
    expect(prompt.messages[2]?.content).toContain("visual_concept");
    expect(prompt.messages[3]?.content).toContain("Be concise");
  });

  it("rejects missing fields and preserves authored line breaks", () => {
    expect(
      validateGeneratedContent(JSON.stringify(output), context).caption,
    ).toBe("First line\nSecond line");
    expect(() => validateGeneratedContent("{}", context)).toThrow();
  });

  it("strips invented URLs and uses canonical ingested source labels", () => {
    const result = validateGeneratedContent(
      JSON.stringify({
        ...output,
        source_refs: [
          {
            title: "Invented",
            url: "https://invented.test/",
            source: "Invented",
          },
          {
            title: "Wrong title",
            url: "https://example.test/news",
            source: "Wrong publisher",
          },
        ],
      }),
      { ...context, pillar: "salesforce_news" },
    );
    expect(result.source_refs).toEqual([
      {
        title: "Verified article",
        url: "https://example.test/news",
        source: "Publisher",
      },
    ]);
  });

  it("rejects sourceless news and hashtags on a no-hashtag platform", () => {
    expect(() =>
      validateGeneratedContent(JSON.stringify(output), {
        ...context,
        pillar: "salesforce_news",
      }),
    ).toThrow(/validation/);
    expect(() =>
      validateGeneratedContent(JSON.stringify(output), {
        ...context,
        platform: "whatsapp",
        platform_rules: {
          ...context.platform_rules,
          label: "WhatsApp Status",
          allows_hashtags: false,
          max_hashtags: 0,
        },
      }),
    ).toThrow(/validation/);
  });

  it("enforces a catalogue platform's hashtag and caption limits", () => {
    const strict = {
      ...context,
      platform: "threads",
      platform_rules: {
        label: "Threads",
        allows_hashtags: true,
        max_hashtags: 1,
        caption_max_chars: 50,
        guidance: "Write in first person.",
      },
    };
    let issues: string[] = [];
    try {
      validateGeneratedContent(
        JSON.stringify({
          ...output,
          hashtags: ["#a", "#b"],
          caption: "x".repeat(51),
        }),
        strict,
      );
    } catch (failure) {
      issues = (failure as { issues: string[] }).issues;
    }
    expect(issues).toEqual([
      "hashtags: Threads allows at most 1",
      "caption: Threads allows at most 50 characters",
    ]);
    const prompt = buildContentPrompt(strict);
    expect(prompt.messages[2]?.content).toContain(
      "Platform: Threads. Use at most 1 hashtags. Keep the caption within 50 characters.",
    );
    expect(prompt.messages[3]?.content).toMatch(
      /^Platform guidance for Threads \(follow it unless it conflicts with the rules above\): "Write in first person\."$/,
    );
  });

  it("repairs a malformed response once and does not mutate content rows", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ content: "not JSON" })
      .mockResolvedValueOnce({ content: JSON.stringify(output) });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await generateContent(context, generate);
    expect(result.content.format).toBe("post");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].messages.at(-1).content).toContain(
      "Repair",
    );
  });

  it("rejects a failed repair after exactly two calls", async () => {
    const generate = vi.fn().mockResolvedValue({ content: "{}" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(generateContent(context, generate)).rejects.toThrow(
      /validation/,
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("allows one repair per validation stage, including parse then schema", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ content: "malformed" })
      .mockResolvedValueOnce({ content: "{}" })
      .mockResolvedValueOnce({ content: JSON.stringify(output) });
    await expect(generateContent(context, generate)).resolves.toMatchObject({
      content: { format: "post" },
    });
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("makes no AI call for news without grounding", async () => {
    const generate = vi.fn();
    await expect(
      generateContent(
        {
          ...context,
          pillar: "salesforce_news",
          news: [],
        },
        generate,
      ),
    ).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
  });

  it("calculates costs with integer arithmetic, rounds to six decimals and rejects missing pricing", () => {
    expect(
      estimateCost(1000000, 1000000, {
        input_usd_per_million: "3",
        output_usd_per_million: "15",
      }),
    ).toBe("18.000000");
    expect(
      estimateCost(1, 0, {
        input_usd_per_million: "0.5",
        output_usd_per_million: "0",
      }),
    ).toBe("0.000001");
    expect(() =>
      estimateCost(-1, 0, {
        input_usd_per_million: "3",
        output_usd_per_million: "15",
      }),
    ).toThrow();
    expect(() =>
      estimateCost(1, 1, {
        input_usd_per_million: "",
        output_usd_per_million: "",
      }),
    ).toThrow();
  });
});
