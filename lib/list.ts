import { UNITS, type Unit } from "./units";

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

// "2 lb", "1.5 gal", "3" (a count with no unit), or "" when there's no amount.
export function formatAmount(quantity: number | null, unit: Unit | null): string {
  if (quantity === null) return "";
  const amount = String(Number(quantity.toFixed(3)));
  return unit ? `${amount} ${UNITS[unit].plural}` : amount;
}
