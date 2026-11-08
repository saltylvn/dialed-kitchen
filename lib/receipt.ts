import { foodMatch, singular } from "./foodEmoji";
import { matchKey } from "./ingredients";
import { nameKey } from "./priceBook";
import { DIMENSIONS, UNITS, type Unit } from "./units";

// Matching receipt lines to the price book (docs/decisions/0033). Pure logic, unit tested.

// How a receipt line is remembered: its printed description in capitals with single spaces,
// without the parts that change every trip (a weight "1.32 lb @ 0.99/lb", a multi-buy
// "2 @ 1.29", the price), so "ORGANIC BANANAS 1.32 lb @ 0.99/lb 1.31" and next week's
// "organic bananas 0.98 lb @ 0.99/lb 0.97" are the same line. (The database checks the form.)
export function receiptKey(text: string): string {
  return text
    .replace(/\d+(\.\d+)?\s*(lbs?|kg|oz|g)?\s*@\s*\$?\d+(\.\d+)?(\s*\/\s*[a-z]+)?/gi, " ")
    .replace(/(\s\$?\d+\.\d{2}(\s?[A-Z])?)+\s*$/i, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .slice(0, 80)
    .trim();
}

export type Suggestion = { itemId: string; how: "remembered" | "name" } | null;

// The price-book item a line probably is, best evidence first:
// 1. you matched this exact receipt text at this store before;
// 2. an item with the same name as the AI's plain name ("Bananas");
// 3. an item whose main name is the same ("Chicken thighs, boneless" ~ "Chicken thighs");
// 4. an item whose every word is in the line's name, and that is the same food
//    ("Boneless Chicken Thighs" ~ "Chicken thighs", but "Milk chocolate" isn't "Milk").
//    The most specific such item wins.
// Otherwise nothing: better to ask than to file a price under the wrong item.
export function suggestItem(
  line: { text: string; name: string },
  items: readonly { id: string; name: string }[],
  remembered: ReadonlyMap<string, string>, // receiptKey → item id, for this store
): Suggestion {
  const known = remembered.get(receiptKey(line.text));
  if (known && items.some((i) => i.id === known)) return { itemId: known, how: "remembered" };

  const byName = items.find((i) => nameKey(i.name) === nameKey(line.name));
  if (byName) return { itemId: byName.id, how: "name" };

  const key = matchKey(line.name);
  const byKey = items.find((i) => matchKey(i.name) === key);
  if (byKey) return { itemId: byKey.id, how: "name" };

  const lineWords = new Set(words(line.name));
  const lineFood = foodMatch(line.name)?.key;
  const byWords = items
    .map((i) => ({ item: i, itemWords: words(i.name) }))
    .filter(
      ({ item, itemWords }) =>
        itemWords.length > 0 &&
        itemWords.every((w) => lineWords.has(w)) &&
        foodMatch(item.name)?.key === lineFood,
    )
    .sort((a, b) => b.itemWords.length - a.itemWords.length)[0];
  return byWords ? { itemId: byWords.item.id, how: "name" } : null;
}

// "Hass Avocados, bag" → ["hass", "avocado", "bag"]: lowercase, singular, letters only.
function words(name: string): string[] {
  return matchKey(name)
    .split(/[^a-zñé]+/)
    .filter(Boolean)
    .map(singular);
}

// How a new item from a receipt compares prices: by the kind of unit on the receipt (a
// weighed item per lb, a bottle per fl oz, anything counted each).
export function compareUnitFor(unit: Unit): Unit {
  return DIMENSIONS[UNITS[unit].dimension].defaultCompareUnit;
}

// Which of the household's stores a receipt is from, by the name printed at the top
// ("TRADER JOE'S #123", "WinCo Foods", "Smith's Food & Drug"). null when unsure: the review
// screen's store wheel then starts at Trader Joe's and you pick.
const STORE_PATTERNS: [string, RegExp][] = [
  ["Trader Joe's", /trader\s*joe/i],
  ["WinCo", /win\s*co/i],
  ["Harmons", /harmons?\b/i],
  ["Smith's", /smith'?s/i],
  ["Costco", /costco/i],
  ["Walmart", /wal[\s-]*mart/i],
];

export function detectStore<S extends { name: string }>(
  printed: string | null,
  stores: readonly S[],
): S | null {
  if (!printed) return null;
  const name = STORE_PATTERNS.find(([, pattern]) => pattern.test(printed))?.[0];
  return stores.find((s) => s.name === name) ?? null;
}
