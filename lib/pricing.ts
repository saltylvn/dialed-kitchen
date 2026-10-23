import { pricePerUnit, unitLabel, UNITS, type Unit } from "./units";

// Comparing a price to the best one found so far, and showing prices. Prices are compared
// by unit price in base units (lib/units). (docs/decisions/0003)

// Prices within half a percent are treated as the same price (rounding noise).
const SAME_PRICE_TOLERANCE = 0.005;

// A best price older than this is labeled "older": it may not be available anymore.
export const OLDER_AFTER_DAYS = 90;

export type Comparison =
  | { kind: "first" } // no earlier price for this item
  | { kind: "new_best"; percentBelow: number } // cheaper than every earlier price
  | { kind: "matches_best" }
  | { kind: "above_best"; percentAbove: number };

// Compares a just-entered unit price to the best earlier one (null if there's none).
export function compareToBest(newUnitPrice: number, bestEarlier: number | null): Comparison {
  if (bestEarlier === null) return { kind: "first" };
  const ratio = newUnitPrice / bestEarlier - 1;
  if (Math.abs(ratio) < SAME_PRICE_TOLERANCE) return { kind: "matches_best" };
  if (ratio < 0) return { kind: "new_best", percentBelow: Math.round(-ratio * 100) };
  return { kind: "above_best", percentAbove: Math.round(ratio * 100) };
}

// Whole days between two calendar dates ("YYYY-MM-DD", the user's local dates).
export function daysBetween(earlier: string, later: string): number {
  const toDay = (date: string) =>
    Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((toDay(later) - toDay(earlier)) / 86_400_000);
}

export function isOlder(observedOn: string, today: string): boolean {
  return daysBetween(observedOn, today) > OLDER_AFTER_DAYS;
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// $1,234.50
export function formatMoney(amount: number): string {
  return dollars.format(amount);
}

// "$1.30/lb", "$0.03/fl oz", "$0.30 each". Unit prices under a dollar keep a third
// decimal place when it matters ($0.034/fl oz), so cheap items still compare clearly.
export function formatUnitPrice(pricePerBaseUnit: number, unit: Unit): string {
  const value = pricePerUnit(pricePerBaseUnit, unit);
  const amount =
    value < 1 && Math.round(value * 1000) % 10 !== 0 ? `$${value.toFixed(3)}` : formatMoney(value);
  return unit === "each" ? `${amount} each` : `${amount}/${UNITS[unit].label}`;
}

// "5 lb", "1.5 gal", "12 each"
export function formatPackage(quantity: number, unit: Unit): string {
  return `${Number(quantity.toFixed(3))} ${unitLabel(quantity, unit)}`;
}
