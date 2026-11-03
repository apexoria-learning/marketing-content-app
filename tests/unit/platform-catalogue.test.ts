import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ catalogue: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({ env: {} }));
vi.mock("../../src/server/db/platforms", async (original) => ({
  ...(await original<typeof import("../../src/server/db/platforms")>()),
  getPlatformCatalogue: mocks.catalogue,
}));

import {
  PlatformInputSchema,
  hasPlannablePlatforms,
  toPlatformIcon,
  type PlatformRecord,
} from "../../src/lib/schemas/platforms";
import {
  buildPlatformCatalogue,
  planningPlatforms,
} from "../../src/server/db/platforms";
import { loadPlanningScope } from "../../src/server/services/planning-scope";
import { PlatformBadge } from "../../src/components/content/PlatformBadge";
import { PlatformCatalogueProvider } from "../../src/components/content/PlatformCatalogue";

function record(overrides: Partial<PlatformRecord> = {}): PlatformRecord {
  return {
    key: "instagram",
    label: "Instagram",
    is_enabled: true,
    sort_order: 1,
    colour_slot: 1,
    icon: "instagram",
    allows_hashtags: true,
    max_hashtags: 30,
    caption_max_chars: null,
    tone: "",
    guidance: "",
    formats: ["post", "reel"],
    updated_at: "2026-11-03T00:00:00Z",
    updated_by: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("catalogue assembly", () => {
  it("joins formats in canonical order and drops formats of other platforms", () => {
    const [platform] = buildPlatformCatalogue(
      [{ ...record(), formats: undefined }],
      [
        { platform_key: "instagram", format: "reel" },
        { platform_key: "instagram", format: "carousel" },
        { platform_key: "linkedin", format: "poll" },
      ],
    );
    expect(platform?.formats).toEqual(["carousel", "reel"]);
  });

  it("offers only enabled platforms with formats to the planner", () => {
    expect(
      planningPlatforms([
        record(),
        record({ key: "retired", is_enabled: false }),
        record({ key: "empty", formats: [] }),
      ]),
    ).toEqual([{ key: "instagram", formats: ["post", "reel"] }]);
  });

  it("requires two enabled platform/format pairs so months stay plannable", () => {
    expect(hasPlannablePlatforms([record({ formats: ["post"] })])).toBe(false);
    expect(
      hasPlannablePlatforms([
        record({ formats: ["post"] }),
        record({ key: "x_app", formats: ["post"] }),
      ]),
    ).toBe(true);
    expect(
      hasPlannablePlatforms([
        record({ formats: ["post"] }),
        record({ key: "x_app", is_enabled: false, formats: ["post"] }),
      ]),
    ).toBe(false);
  });
});

describe("platform input contract", () => {
  const valid = {
    key: "youtube_shorts",
    label: " YouTube Shorts ",
    is_enabled: true,
    colour_slot: 4,
    icon: "video",
    formats: ["reel"],
    allows_hashtags: true,
    max_hashtags: 3,
    caption_max_chars: 100,
    tone: "Fast",
    guidance: "",
  };

  it("accepts a well-formed new platform and trims its name", () => {
    expect(PlatformInputSchema.parse(valid).label).toBe("YouTube Shorts");
  });

  it.each([
    { key: "YouTube" },
    { key: "a" },
    { colour_slot: 9 },
    { icon: "uploaded-logo" },
    { formats: [] },
    { formats: ["reel", "reel"] },
    { formats: ["thread"] },
    { max_hashtags: 31 },
    { caption_max_chars: 10 },
    { guidance: "x".repeat(1001) },
    { updated_by: "attacker@example.test" },
  ])("rejects %j", (change) => {
    expect(PlatformInputSchema.safeParse({ ...valid, ...change }).success).toBe(
      false,
    );
  });

  it("falls back to the generic glyph for unknown icons", () => {
    expect(toPlatformIcon("video")).toBe("video");
    expect(toPlatformIcon("unknown")).toBe("platform");
  });
});

describe("planning scope", () => {
  it("anchors context on the first enabled platform and its first format", async () => {
    mocks.catalogue.mockResolvedValue([
      record({ key: "retired", is_enabled: false, formats: ["poll"] }),
      record({ key: "threads", formats: ["post", "story"] }),
    ]);
    await expect(
      loadPlanningScope({ enabledPillars: ["memes"] }),
    ).resolves.toEqual({
      filters: {
        platforms: [{ key: "threads", formats: ["post", "story"] }],
        pillars: ["memes"],
      },
      anchor: { platform: "threads", format: "post" },
    });
  });

  it("fails closed with guidance when nothing is plannable", async () => {
    mocks.catalogue.mockResolvedValue([record({ formats: ["post"] })]);
    await expect(
      loadPlanningScope({ enabledPillars: ["memes"] }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      userMessage:
        "Enable at least two platform formats in Admin → Platforms. Nothing was changed.",
    });
  });
});

describe("catalogue-driven badge", () => {
  it("renders the admin label and colour slot, and a readable fallback", () => {
    const html = renderToStaticMarkup(
      createElement(
        PlatformCatalogueProvider,
        {
          platforms: [
            {
              key: "youtube_shorts",
              label: "YouTube Shorts",
              is_enabled: true,
              colour_slot: 6,
              icon: "video",
            },
          ],
        },
        createElement(PlatformBadge, { platform: "youtube_shorts" }),
        createElement(PlatformBadge, { platform: "old_network" }),
      ),
    );
    expect(html).toContain("YouTube Shorts");
    expect(html).toContain("text-platform-6");
    expect(html).toContain("old network");
    expect(html).toContain("text-secondary");
  });
});
