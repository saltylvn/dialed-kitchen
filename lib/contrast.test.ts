import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, readColorTokens } from "./contrast";

const tokens = readColorTokens(readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"));

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
    ["on-accent", "accent"],
    ["success-text", "bg"],
    ["success-text", "surface"],
    ["info-text", "bg"],
    ["info-text", "surface"],
  ];

  it.each(pairs)("--%s on --%s", (text, background) => {
    expect(tokens[text], `--${text} missing from globals.css`).toBeDefined();
    expect(tokens[background], `--${background} missing from globals.css`).toBeDefined();
    expect(contrastRatio(tokens[text], tokens[background])).toBeGreaterThanOrEqual(4.5);
  });
});
