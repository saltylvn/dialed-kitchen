import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, readColorTokens } from "./contrast";

const tokens = readColorTokens(
  readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"),
);

describe("contrastRatio", () => {
  it("gives 21 for black on white and 1 for a color on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#d97757", "#d97757")).toBeCloseTo(1);
  });
});

// Every color used for text, on every background it appears on, must reach 4.5:1.
describe("app colors are readable in sunlight", () => {
  const pairs: [text: string, background: string][] = [
    ["text", "bg"],
    ["text", "surface"],
    ["muted", "bg"],
    ["muted", "surface"],
    ["text", "surface-2"],
    ["muted", "surface-2"],
    ["on-primary", "primary"],
    ["on-accent", "accent"],
    ["success-text", "bg"],
    ["success-text", "surface"],
    ["info-text", "bg"],
    ["info-text", "surface"],
  ];

  it.each(pairs)("--%s on --%s", (text, background) => {
    const fg = tokens.get(text);
    const bg = tokens.get(background);
    if (!fg) throw new Error(`--${text} missing from globals.css`);
    if (!bg) throw new Error(`--${background} missing from globals.css`);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

// Shapes that carry meaning without text (the cheapest store's green outline, the violet
// active-tab bar and focus ring) must reach 3:1 against the page (WCAG non-text contrast).
describe("app colors are visible as outlines and bars", () => {
  const pairs: [color: string, background: string][] = [
    ["primary", "bg"],
    ["accent", "bg"],
    ["accent", "surface"],
  ];

  it.each(pairs)("--%s on --%s", (color, background) => {
    const fg = tokens.get(color);
    const bg = tokens.get(background);
    if (!fg) throw new Error(`--${color} missing from globals.css`);
    if (!bg) throw new Error(`--${background} missing from globals.css`);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe("contrastRatio input checks", () => {
  it("rejects colors that aren't #rrggbb", () => {
    expect(() => contrastRatio("orange", "#ffffff")).toThrow(/#rrggbb/);
    expect(() => contrastRatio("#fff", "#ffffff")).toThrow(/#rrggbb/);
  });
});
