import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// DESIGN.md §3.4 contrast floors, verified for both themes (§12).
const css = readFileSync(
  new URL("../../src/styles/tokens.css", import.meta.url),
  "utf8",
);

type Rgba = [number, number, number, number];

function readBlock(selector: string): Record<string, string> {
  const tokens: Record<string, string> = {};

  for (const [, head = "", body = ""] of css.matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    if (head.trim() !== selector) {
      continue;
    }

    for (const [, name = "", value = ""] of body.matchAll(
      /--([\w-]+):\s*([^;]+);/g,
    )) {
      tokens[name] = value.trim();
    }
  }

  return tokens;
}

function parseColour(value: string | undefined): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value ?? "");

  if (hex) {
    const n = Number.parseInt(hex[1] ?? "", 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }

  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/.exec(value ?? "");

  if (rgb) {
    return [
      Number(rgb[1]),
      Number(rgb[2]),
      Number(rgb[3]),
      Number(rgb[4]) / 100,
    ];
  }

  throw new Error(`Unsupported colour: ${value}`);
}

function composite(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top[3];
  return [
    top[0] * alpha + bottom[0] * (1 - alpha),
    top[1] * alpha + bottom[1] * (1 - alpha),
    top[2] * alpha + bottom[2] * (1 - alpha),
    1,
  ];
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgba): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(foreground: Rgba, background: Rgba): number {
  const solidBackground = composite(background, [0, 0, 0, 1]);
  const solidForeground = composite(foreground, solidBackground);
  const a = luminance(solidForeground);
  const b = luminance(solidBackground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const SURFACES = ["canvas", "surface-1", "surface-2", "surface-sunken"];

// [foreground, background, floor, reason]
const PAIRS: Array<[string, string, number, string]> = [
  ...SURFACES.flatMap((surface): Array<[string, string, number, string]> => [
    ["text-primary", surface, 4.5, "body text"],
    ["text-secondary", surface, 4.5, "supporting text"],
    // Tertiary is restricted to non-essential 13px+ text (§3.4).
    ["text-tertiary", surface, 3, "non-essential text"],
    ["accent", surface, 3, "focus ring, tick, progress arc"],
    ["danger", surface, 3, "error glyphs"],
    ["platform-instagram", surface, 3, "platform glyph"],
    ["platform-linkedin", surface, 3, "platform glyph"],
    ["platform-whatsapp", surface, 3, "platform glyph"],
  ]),
  ["accent-on", "accent", 4.5, "primary button label"],
  ["danger", "danger-muted@surface-1", 4.5, "danger banner/button text"],
  ["text-primary", "accent-muted@surface-1", 4.5, "selected chip text"],
];

function resolve(theme: Record<string, string>, name: string): Rgba {
  const [token = "", base] = name.split("@");
  const colour = parseColour(theme[token]);
  return base ? composite(colour, resolve(theme, base)) : colour;
}

const dark = readBlock(":root");
const light = { ...dark, ...readBlock('[data-theme="light"]') };

describe.each([
  ["dark", dark],
  ["light", light],
])("%s theme token contrast", (_, theme) => {
  it.each(PAIRS)("%s on %s ≥ %s:1 (%s)", (foreground, background, floor) => {
    const ratio = contrastRatio(
      resolve(theme, foreground),
      resolve(theme, background),
    );
    expect(ratio).toBeGreaterThanOrEqual(floor);
  });
});
