import { UNITS, type Dimension, type Unit } from "./units";

// Package size as swipe wheels (docs/decisions/0040): a whole number, a kitchen fraction,
// and a unit. Pure logic, unit tested.

// The fraction wheel, top to bottom.
export const SIZE_FRACTIONS = [
  { label: "–", value: 0 },
  { label: "¼", value: 1 / 4 },
  { label: "⅓", value: 1 / 3 },
  { label: "½", value: 1 / 2 },
  { label: "⅔", value: 2 / 3 },
  { label: "¾", value: 3 / 4 },
] as const;

export const MAX_WHOLE = 500;

// The wheels' values as the amount the form sends: 1 and ½ → "1.5", 0 and ⅓ → "0.333".
// (Three decimals at most, which is what the form accepts.)
export function sizeAmount(whole: number, fractionIndex: number): string {
  const fraction = SIZE_FRACTIONS[fractionIndex]?.value ?? 0;
  return String(Math.round((whole + fraction) * 1000) / 1000);
}

// Where the unit wheel starts: ounces, the owner's default. Ounces of weight for things
// priced by weight, fluid ounces for drinks, and "each" for things priced per item (an
// ounce can't be compared with a per-item price).
export function defaultSizeUnit(dimension: Dimension): Unit {
  return dimension === "weight" ? "oz" : dimension === "volume" ? "fl_oz" : "each";
}

// Where the price wheels start, so they agree with the size wheels' start (1 of the
// default unit): the last price per unit, times one default unit. $3.49/lb starts at $0.22
// for 1 oz; a bag of 6 avocados at $5.99 starts at $1.00 for 1 each. With no price yet,
// $1.00.
export function startingPrice(lastUnitPriceBase: number | null, dimension: Dimension): number {
  if (lastUnitPriceBase === null || !(lastUnitPriceBase > 0)) return 1;
  const price = lastUnitPriceBase * UNITS[defaultSizeUnit(dimension)].toBase;
  return Math.max(0.01, Math.round(price * 100) / 100);
}
