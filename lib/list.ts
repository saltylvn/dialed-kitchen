import { unitLabel, type Unit } from "./units";

// Grocery list helpers: order and amounts.

export type Sortable = { checked: boolean; createdAt: string; name: string };

// Still to buy first (oldest first, in the order they were added), then checked items
// (most recently checked last is fine: by name, so they're easy to scan).
export function sortList<T extends Sortable>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    if (!a.checked) return a.createdAt.localeCompare(b.createdAt);
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

// Kitchen fractions, the way recipes write amounts.
const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

// 0.5 → "½", 1.5 → "1½", 0.333 → "⅓", 2 → "2"; anything else stays a decimal (0.6 → "0.6").
export function formatQuantity(quantity: number): string {
  const whole = Math.floor(quantity + 0.005);
  const rest = quantity - whole;
  if (rest < 0.005) return String(whole);
  const fraction = FRACTIONS.find(([value]) => Math.abs(rest - value) < 0.01);
  if (fraction) return whole === 0 ? fraction[1] : `${whole}${fraction[1]}`;
  return String(Number(quantity.toFixed(3)));
}

// "2 lb", "1½ gal", "½ tsp", "3" (a count with no unit), or "" when there's no amount.
export function formatAmount(quantity: number | null, unit: Unit | null): string {
  if (quantity === null) return "";
  const amount = formatQuantity(quantity);
  return unit ? `${amount} ${unitLabel(quantity, unit)}` : amount;
}
