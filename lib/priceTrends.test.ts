import { describe, expect, it } from "vitest";
import { chartPoints, pricesByStore, trendSummary, type Observation } from "./priceTrends";

const STORES = [
  { id: "winco", name: "WinCo" },
  { id: "tj", name: "Trader Joe's" },
  { id: "costco", name: "Costco" },
];

const p = (store_id: string, unit_price_base: number, observed_on: string, on_sale = false) =>
  ({ store_id, unit_price_base, observed_on, on_sale }) satisfies Observation;

describe("pricesByStore", () => {
  it("uses each store's latest price, cheapest first, never-priced stores last", () => {
    const rows = pricesByStore(
      [
        p("winco", 0.01, "2026-01-01", true), // an old sale…
        p("winco", 0.03, "2026-10-01"), // …WinCo's price now
        p("costco", 0.02, "2026-09-15"),
      ],
      STORES,
    );
    expect(rows.map((r) => [r.storeName, r.latest?.unit_price_base ?? null, r.cheapest])).toEqual([
      ["Costco", 0.02, true],
      ["WinCo", 0.03, false],
      ["Trader Joe's", null, false],
    ]);
  });

  it("marks ties (within rounding) as cheapest too", () => {
    const rows = pricesByStore([p("winco", 1, "2026-10-01"), p("tj", 1.004, "2026-10-01")], STORES);
    expect(rows.filter((r) => r.cheapest).map((r) => r.storeName)).toEqual([
      "WinCo",
      "Trader Joe's",
    ]);
  });

  it("lists every store even with no prices", () => {
    expect(pricesByStore([], STORES).map((r) => [r.storeName, r.cheapest])).toEqual([
      ["WinCo", false],
      ["Trader Joe's", false],
      ["Costco", false],
    ]);
  });
});

describe("trendSummary", () => {
  it("compares the latest price with the earliest in the last six months", () => {
    expect(
      trendSummary([
        p("winco", 5, "2025-01-01"), // too old to count
        p("winco", 2, "2026-05-01"),
        p("winco", 2.5, "2026-10-01"),
      ]),
    ).toEqual({ kind: "up", percent: 25, since: "2026-05-01" });
    expect(trendSummary([p("winco", 2, "2026-05-01"), p("tj", 1.5, "2026-10-01")])).toEqual({
      kind: "down",
      percent: 25,
      since: "2026-05-01",
    });
  });

  it("calls small moves the same, and uses each day's lowest price", () => {
    expect(trendSummary([p("winco", 2, "2026-05-01"), p("winco", 2.02, "2026-10-01")])).toEqual({
      kind: "same",
      since: "2026-05-01",
    });
    expect(
      trendSummary([
        p("winco", 2, "2026-05-01"),
        p("winco", 2, "2026-10-01"),
        p("costco", 9, "2026-10-01"), // a pricier store the same day doesn't make it "up"
      ]),
    ).toEqual({ kind: "same", since: "2026-05-01" });
  });

  it("needs two different days", () => {
    expect(trendSummary([p("winco", 2, "2026-10-01")])).toBeNull();
    expect(trendSummary([p("winco", 2, "2026-10-01"), p("tj", 3, "2026-10-01")])).toBeNull();
  });
});

describe("chartPoints", () => {
  it("spreads points by date and price inside the padding", () => {
    const points = chartPoints(
      [p("winco", 3, "2026-10-11"), p("winco", 1, "2026-10-01"), p("winco", 2, "2026-10-06")],
      116,
      66,
      8,
    );
    expect(points.map(({ x, y }) => [x, y])).toEqual([
      [8, 58], // oldest, cheapest: left, bottom
      [58, 33],
      [108, 8], // newest, priciest: right, top
    ]);
  });

  it("draws a flat price in the middle", () => {
    const points = chartPoints([p("winco", 2, "2026-10-01"), p("tj", 2, "2026-10-05")], 100, 60);
    expect(points.map((pt) => pt.y)).toEqual([30, 30]);
  });
});
