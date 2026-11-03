import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("../../src/server/config/env", () => ({ env: {} }));

import {
  PillarInputSchema,
  pillarDisplayFor,
  pillarPlannabilityError,
} from "../../src/lib/schemas/pillars";
import {
  buildPillarCatalogue,
  planningPillars,
} from "../../src/server/db/pillars";
import {
  PillarChip,
  PillarName,
} from "../../src/components/content/PillarChip";
import { PillarCatalogueProvider } from "../../src/components/content/PillarCatalogue";
import { ReadFilters } from "../../src/features/content/ReadFilters";
import { parseReadParams } from "../../src/lib/schemas/read-params";
import { suggestCatalogueKey } from "../../src/lib/utils/catalogue-key";

function row(key: string, overrides = {}) {
  return {
    key,
    label: key,
    description: `About ${key}`,
    guidance: "",
    requires_news: false,
    is_enabled: true,
    sort_order: 1,
    updated_at: "2026-11-03T00:00:00Z",
    updated_by: null,
    ...overrides,
  };
}

describe("pillar catalogue assembly", () => {
  it("offers only enabled pillars, with their rules, to the planners", () => {
    const catalogue = buildPillarCatalogue([
      row("python_tips", { guidance: "Show code." }),
      row("retired", { is_enabled: false }),
      row("py_news", { requires_news: true }),
    ]);
    expect(planningPillars(catalogue)).toEqual([
      {
        key: "python_tips",
        label: "python_tips",
        description: "About python_tips",
        guidance: "Show code.",
        requires_news: false,
      },
      {
        key: "py_news",
        label: "py_news",
        description: "About py_news",
        guidance: "",
        requires_news: true,
      },
    ]);
  });

  it("rejects malformed catalogue rows instead of trusting them", () => {
    expect(() => buildPillarCatalogue([row("Bad Key")])).toThrow();
  });
});

describe("pillar plannability (mirrors save_pillar)", () => {
  const enabled = (requires_news = false) => ({
    is_enabled: true,
    requires_news,
  });

  it("needs three enabled pillars that do not need news", () => {
    expect(pillarPlannabilityError([enabled(), enabled(), enabled(true)])).toBe(
      "Keep at least 3 enabled pillars that do not need news.",
    );
    expect(
      pillarPlannabilityError([
        enabled(),
        enabled(),
        { is_enabled: false, requires_news: false },
      ]),
    ).not.toBeNull();
    expect(
      pillarPlannabilityError([enabled(), enabled(), enabled(), enabled(true)]),
    ).toBeNull();
  });

  it("allows at most fourteen enabled pillars", () => {
    expect(
      pillarPlannabilityError(Array.from({ length: 14 }, () => enabled())),
    ).toBeNull();
    expect(
      pillarPlannabilityError(Array.from({ length: 15 }, () => enabled())),
    ).toBe("Enable at most 14 pillars.");
  });
});

describe("pillar input contract", () => {
  const valid = {
    key: "python_tips",
    label: " Python tips ",
    description: " Small Python lessons ",
    guidance: "",
    requires_news: false,
    is_enabled: true,
  };

  it("accepts a well-formed pillar and trims its text", () => {
    expect(PillarInputSchema.parse(valid)).toMatchObject({
      label: "Python tips",
      description: "Small Python lessons",
    });
  });

  it.each([
    { key: "Python" },
    { key: "p" },
    { label: "" },
    { label: "x".repeat(31) },
    { description: "  " },
    { description: "x".repeat(301) },
    { guidance: "x".repeat(1001) },
    { requires_news: "yes" },
    { sort_order: 1 },
    { updated_by: "attacker@example.test" },
  ])("rejects %j", (change) => {
    expect(PillarInputSchema.safeParse({ ...valid, ...change }).success).toBe(
      false,
    );
  });

  it("suggests permanent keys from names", () => {
    expect(suggestCatalogueKey("  Python Tips! ")).toBe("python_tips");
    expect(suggestCatalogueKey("2024 Jobs")).toBe("jobs");
  });
});

describe("catalogue-driven pillar display", () => {
  const catalogue = [
    {
      key: "python_tips",
      label: "Py tips",
      is_enabled: true,
      requires_news: false,
    },
    {
      key: "py_news",
      label: "Py news",
      is_enabled: false,
      requires_news: true,
    },
  ];

  it("renders admin labels and a readable fallback for unknown keys", () => {
    const html = renderToStaticMarkup(
      createElement(
        PillarCatalogueProvider,
        { pillars: catalogue },
        createElement(PillarChip, { pillar: "python_tips" }),
        createElement(PillarName, { pillar: "old_theme" }),
      ),
    );
    expect(html).toContain("Py tips");
    expect(html).toContain("old theme");
  });

  it("resolves the news flag from the catalogue, never from the key", () => {
    expect(pillarDisplayFor(catalogue, "py_news").requires_news).toBe(true);
    expect(pillarDisplayFor(catalogue, "salesforce_news").requires_news).toBe(
      false,
    );
  });

  it("lists catalogue pillars, including retired ones, in the read filters", () => {
    const html = renderToStaticMarkup(
      createElement(ReadFilters, {
        path: "/archive",
        params: parseReadParams({ scope: "all" }),
        platforms: [],
        pillars: catalogue,
      }),
    );
    expect(html).toContain('<option value="python_tips">Py tips</option>');
    expect(html).toContain('<option value="py_news">Py news</option>');
  });
});
