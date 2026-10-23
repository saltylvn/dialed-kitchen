// WCAG contrast ratio between two "#rrggbb" colors: 1 (no contrast) to 21 (black on white).
// Text needs 4.5 or more to stay readable, which matters in bright sunlight.

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

// Relative luminance (how bright a color looks to the eye), per the WCAG formula.
function luminance(hex: string): number {
  const match = HEX_COLOR.exec(hex);
  if (!match) throw new Error(`Expected a "#rrggbb" color, got "${hex}"`);
  const [r, g, b] = match.slice(1).map((pair) => {
    const v = parseInt(pair, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Reads the "--name: #hex;" color tokens out of a CSS file's text.
export function readColorTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [, name, hex] of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    if (name && hex) tokens.set(name, hex.toLowerCase());
  }
  return tokens;
}
