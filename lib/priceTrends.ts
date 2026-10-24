import { daysBetween } from "./pricing";

// Where an item is cheapest now, and how its price has moved (docs/decisions/0020). Works on
// unit prices in base units (lib/units), so different package sizes compare fairly.

export type Observation = {
  store_id: string;
  unit_price_base: number;
  observed_on: string; // YYYY-MM-DD
  on_sale: boolean;
};

export type StorePrice = {
  storeId: string;
  storeName: string;
  latest: Observation | null; // the most recent price there, null if never priced
  cheapest: boolean; // lowest latest price of all stores (ties all marked)
};

// Each store's most recent price, cheapest first; stores never priced come last, in their
// usual order. "Now" means the latest price per store, not the best ever: the best ever
// may have been a one-off sale.
export function pricesByStore(
  history: readonly Observation[],
  stores: readonly { id: string; name: string }[],
): StorePrice[] {
  const latest = new Map<string, Observation>();
  for (const p of history) {
    const seen = latest.get(p.store_id);
    if (!seen || p.observed_on > seen.observed_on) latest.set(p.store_id, p);
  }
  const lowest = Math.min(...[...latest.values()].map((p) => p.unit_price_base));
  const rows = stores.map((s): StorePrice => {
    const p = latest.get(s.id) ?? null;
    return {
      storeId: s.id,
      storeName: s.name,
      latest: p,
      // Within half a percent counts as the same price (rounding noise).
      cheapest: p !== null && p.unit_price_base <= lowest * 1.005,
    };
  });
  // Priced stores by price; unpriced keep the usual store order (a stable sort).
  return rows.sort((a, b) => {
    if (a.latest && b.latest) return a.latest.unit_price_base - b.latest.unit_price_base;
    if (a.latest || b.latest) return a.latest ? -1 : 1;
    return 0;
  });
}

// How far back the trend compares: the latest price against the earliest one in this window.
export const TREND_WINDOW_DAYS = 180;

export type Trend =
  { kind: "up" | "down"; percent: number; since: string } | { kind: "same"; since: string };

// The latest price compared with the earliest in the last TREND_WINDOW_DAYS. null when
// there's nothing to compare (fewer than two different days).
export function trendSummary(history: readonly Observation[]): Trend | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.observed_on.localeCompare(b.observed_on));
  const last = sorted[sorted.length - 1]!;
  const first =
    sorted.find((p) => daysBetween(p.observed_on, last.observed_on) <= TREND_WINDOW_DAYS) ??
    sorted[0]!;
  if (first.observed_on === last.observed_on) return null;
  // Same-day prices: compare the day's lowest, so two stores on one day don't skew it.
  const lowestOn = (day: string) =>
    Math.min(...sorted.filter((p) => p.observed_on === day).map((p) => p.unit_price_base));
  const change = lowestOn(last.observed_on) / lowestOn(first.observed_on) - 1;
  const percent = Math.round(Math.abs(change) * 100);
  if (percent < 2) return { kind: "same", since: first.observed_on };
  return { kind: change > 0 ? "up" : "down", percent, since: first.observed_on };
}

export type ChartPoint = { x: number; y: number; observation: Observation };

// Places prices on a width × height chart: time left to right (by real dates, so gaps show),
// price bottom to top with a little headroom. Pure math; the page draws the SVG.
export function chartPoints(
  history: readonly Observation[],
  width: number,
  height: number,
  pad = 8,
): ChartPoint[] {
  if (history.length === 0) return [];
  const sorted = [...history].sort((a, b) => a.observed_on.localeCompare(b.observed_on));
  const first = sorted[0]!.observed_on;
  const span = Math.max(1, daysBetween(first, sorted[sorted.length - 1]!.observed_on));
  const prices = sorted.map((p) => p.unit_price_base);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const range = hi - lo || hi || 1; // flat line: draw it in the middle
  return sorted.map((p) => ({
    x: pad + (daysBetween(first, p.observed_on) / span) * (width - 2 * pad),
    y: hi === lo ? height / 2 : pad + (1 - (p.unit_price_base - lo) / range) * (height - 2 * pad),
    observation: p,
  }));
}
