import { describe, expect, it } from "vitest";
import { UNITS } from "../units";
import { parsePriceAnswer, pricePrompt } from "./priceEstimate";
import type { NeedsEstimate } from "../weekCost";

const asked: NeedsEstimate[] = [
  { name: "Ground beef, 80/20", key: "ground beef", dimension: "weight" },
  { name: "Onions", key: "onions", dimension: "count" },
  { name: "Milk", key: "milk", dimension: "volume" },
];

describe("pricePrompt", () => {
  it("numbers each ingredient with the unit to price it in", () => {
    expect(pricePrompt(asked)).toBe(
      "Ingredients:\n1. Ground beef, 80/20 (per lb)\n2. Onions (each)\n3. Milk (per fl oz)",
    );
  });
});

describe("parsePriceAnswer", () => {
  it("turns shelf prices into per-gram, per-item and per-ml prices", () => {
    const parsed = parsePriceAnswer(
      JSON.stringify({
        prices: [
          { id: 1, price: 5.49 },
          { id: 2, price: 0.79 },
          { id: 3, price: 0.03 },
        ],
      }),
      asked,
    );
    expect(parsed.ok && parsed.estimates).toEqual([
      {
        key: "ground beef",
        dimension: "weight",
        unitPriceBase: expect.closeTo(5.49 / UNITS.lb.toBase, 5),
      },
      { key: "onions", dimension: "count", unitPriceBase: 0.79 },
      {
        key: "milk",
        dimension: "volume",
        unitPriceBase: expect.closeTo(0.03 / UNITS.fl_oz.toBase, 5),
      },
    ]);
  });

  it("drops prices out of range, ids not asked for, and repeats", () => {
    const parsed = parsePriceAnswer(
      JSON.stringify({
        prices: [
          { id: 1, price: 0 },
          { id: 2, price: 900 },
          { id: 9, price: 2 },
          { id: 3, price: 0.04 },
          { id: 3, price: 0.05 },
        ],
      }),
      asked,
    );
    expect(parsed.ok && parsed.estimates.map((e) => e.key)).toEqual(["milk"]);
  });

  it("rejects replies that aren't the expected JSON", () => {
    expect(parsePriceAnswer("not json", asked)).toEqual({ ok: false, reason: "not_json" });
    expect(parsePriceAnswer('{"prices":"lots"}', asked)).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
  });
});
