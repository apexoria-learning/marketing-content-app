import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  ContentItemSchema,
  PlatformSchema,
  FormatSchema,
  PillarSchema,
  CarouselBodySchema,
  ReelBodySchema,
  PollBodySchema,
  SourceRefSchema,
  DesignBriefSchema,
  type ContentItem,
  type Platform,
  type ContentFormat,
  type Pillar,
} from "../../src/lib/schemas/content";
import type { Enums } from "../../src/server/db/database.types";
import { parseReadParams } from "../../src/lib/schemas/read-params";
import {
  monthBounds,
  shiftMonth,
  shiftDate,
  todayInIst,
} from "../../src/lib/utils/dates";
import { canChangeStatus } from "../../src/lib/utils/status";
import { ContentCard } from "../../src/components/content/ContentCard";
import { SourceList } from "../../src/components/content/SourceList";
import { BriefSection } from "../../src/components/content/BriefSection";

vi.mock("server-only", () => ({}));

const fixture = {
  id: "c862f630-7968-4b35-b048-9b7e9183fef1",
  plan_id: null,
  scheduled_date: "2026-11-01",
  slot: 1,
  platform: "instagram",
  format: "post",
  pillar: "salesforce_tips",
  idea: "Teach one idea",
  title: "Title",
  hook: "A hook",
  caption: "First line\n\nSecond line 🚀",
  body: { visual_concept: "One frame" },
  hashtags: ["#salesforce"],
  cta: "Try this",
  design_brief: {
    objective: "Teach",
    visual_direction: "Type-led",
    layout_notes: "Margins",
    typography: "Inter",
    must_include: ["Wordmark"],
    must_avoid: ["Stock"],
    specs: {
      dimensions: "1080x1350",
      aspect_ratio: "4:5",
      safe_area: "96px",
      slide_count: null,
    },
  },
  source_refs: [],
  status: "ready",
  posted_at: null,
  posted_by: null,
  skip_reason: null,
  regenerated_count: 0,
  prompt_version: "seed-v1",
  generation_error: null,
  hydrated_at: "2026-11-01T00:00:00Z",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

describe("domain schemas and plain-text rendering", () => {
  it("matches all generated enum unions", () => {
    expectTypeOf<Platform>().toEqualTypeOf<Enums<"platform">>();
    expectTypeOf<ContentFormat>().toEqualTypeOf<Enums<"content_format">>();
    expectTypeOf<Pillar>().toEqualTypeOf<Enums<"content_pillar">>();
    expect(PlatformSchema.options).toHaveLength(3);
    expect(FormatSchema.options).toHaveLength(6);
    expect(PillarSchema.options).toHaveLength(10);
  });
  it.each([
    {
      format: "carousel",
      body: {
        slides: [
          { index: 1, headline: "Cover", body: "Text", visual_note: null },
        ],
      },
    },
    {
      format: "reel",
      body: {
        duration_seconds: 28,
        scenes: [
          { from: "0:00", to: "0:28", action: "Speak", on_screen_text: "Text" },
        ],
        audio: "Voiceover",
      },
    },
    { format: "post", body: { visual_concept: "Type-led" } },
    { format: "story", body: { frame: "Frame", interaction_prompt: "Reply" } },
    {
      format: "meme",
      body: { template: "Reaction", top_text: "Top", bottom_text: "Bottom" },
    },
    { format: "poll", body: { question: "Which?", options: ["A", "B"] } },
  ])("parses and renders $format", (body) => {
    const parsed = ContentItemSchema.parse({ ...fixture, ...body });
    expect(
      renderToStaticMarkup(createElement(ContentCard, { item: parsed })),
    ).toContain("A hook");
  });
  it.each([
    { slot: 3 },
    { id: "not-a-uuid" },
    { scheduled_date: "2026-02-30" },
    { platform: "whatsapp" },
    { body: null },
    { caption: null },
    { status: "posted" },
    { skip_reason: "orphaned" },
    { body: { visual_concept: "X", injected: true } },
  ])("rejects malformed/partial usable content: %j", (changes) => {
    expect(
      ContentItemSchema.safeParse({ ...fixture, ...changes }).success,
    ).toBe(false);
  });
  it("accepts a genuinely unhydrated idea", () => {
    expect(
      ContentItemSchema.parse({
        ...fixture,
        status: "idea",
        body: null,
        caption: null,
        hook: null,
        design_brief: null,
        hydrated_at: null,
      }).status,
    ).toBe("idea");
  });
  it("validates nested slide indexes, time ranges and poll options", () => {
    expect(
      CarouselBodySchema.safeParse({
        slides: [{ index: 2, headline: "X", body: "X", visual_note: null }],
      }).success,
    ).toBe(false);
    expect(
      ReelBodySchema.safeParse({
        duration_seconds: 5,
        audio: "X",
        scenes: [
          { from: "0:04", to: "0:09", action: "X", on_screen_text: "X" },
        ],
      }).success,
    ).toBe(false);
    expect(
      PollBodySchema.safeParse({ question: "X", options: ["A", "A"] }).success,
    ).toBe(false);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,bad",
    "https://user:password@example.test",
  ])("rejects unsafe source %s", (url) => {
    expect(
      SourceRefSchema.safeParse({ title: "X", source: "X", url }).success,
    ).toBe(false);
  });
  it("escapes authored markup rather than rendering HTML", () => {
    const item = ContentItemSchema.parse({
      ...fixture,
      hook: "<script>alert(1)</script>",
    });
    const html = renderToStaticMarkup(createElement(ContentCard, { item }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('style="');
  });
  it("warns explicitly for sourceless news and omits empty non-news sections", () => {
    expect(
      renderToStaticMarkup(
        createElement(SourceList, { sources: [], isNews: true }),
      ),
    ).toContain("Do not publish");
    expect(
      renderToStaticMarkup(
        createElement(SourceList, { sources: [], isNews: false }),
      ),
    ).toBe("");
  });
  it("renders design brief sections in fixed order", () => {
    const html = renderToStaticMarkup(
      createElement(BriefSection, {
        brief: DesignBriefSchema.parse(fixture.design_brief),
      }),
    );
    const labels = [
      "Objective",
      "Visual direction",
      "Layout notes",
      "Typography",
      "Must include",
      "Must avoid",
      "Specs",
    ];
    expect(labels.map((label) => html.indexOf(label))).toEqual(
      labels.map((label) => html.indexOf(label)).sort((a, b) => a - b),
    );
  });
});

describe("IST dates and validated URL defaults", () => {
  it("uses IST at UTC midnight and month boundaries", () => {
    expect(todayInIst(new Date("2026-10-31T18:29:59Z"))).toBe("2026-10-31");
    expect(todayInIst(new Date("2026-10-31T18:30:00Z"))).toBe("2026-11-01");
    expect(monthBounds("2028-02")).toEqual({
      start: "2028-02-01",
      end: "2028-03-01",
    });
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("does not echo invalid, repeated or adversarial search input", () => {
    const result = parseReadParams({
      month: ["2026-11", "evil"],
      platform: "<script>",
      format: ["post"],
      scope: "injected",
      status: "unknown",
      pillar: "unknown",
    });
    expect(result).toEqual({
      month: todayInIst().slice(0, 7),
      scope: "this_month",
      platform: undefined,
      format: undefined,
      status: undefined,
      pillar: undefined,
    });
  });
  it("keeps all allowed filter values", () => {
    expect(
      parseReadParams({
        month: "2026-11",
        platform: "linkedin",
        format: "poll",
        pillar: "career_guidance",
        status: "posted",
        scope: "all",
      }),
    ).toMatchObject({
      month: "2026-11",
      platform: "linkedin",
      format: "poll",
      status: "posted",
      scope: "all",
    });
  });
});

describe("complete status transition matrix", () => {
  const legal = new Set([
    "idea:ready",
    "idea:skipped",
    "ready:posted",
    "ready:skipped",
    "posted:ready",
    "skipped:ready",
  ]);
  for (const from of ["idea", "ready", "posted", "skipped"] as const) {
    for (const to of ["idea", "ready", "posted", "skipped"] as const) {
      it(`${from} → ${to}`, () =>
        expect(canChangeStatus(from, to)).toBe(
          from === to || legal.has(`${from}:${to}`),
        ));
    }
  }
});

expectTypeOf<ContentItem>().toEqualTypeOf<
  ReturnType<typeof ContentItemSchema.parse>
>();
