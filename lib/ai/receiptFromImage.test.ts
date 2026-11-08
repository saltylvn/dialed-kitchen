import { describe, expect, it } from "vitest";
import { parseReceiptAnswer } from "./receiptFromImage";

const line = (over: Record<string, unknown> = {}) => ({
  text: "ORG BANANAS",
  name: "Bananas",
  totalPrice: 1.31,
  count: 1,
  size: 1.32,
  sizeUnit: "lb",
  onSale: false,
  ...over,
});

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    found: true,
    storeName: "Trader Joe's",
    date: "2026-11-07",
    lines: [line()],
    ...over,
  });

describe("parseReceiptAnswer", () => {
  it("accepts a well-formed receipt", () => {
    expect(parseReceiptAnswer(answer())).toEqual({
      ok: true,
      receipt: {
        storeName: "Trader Joe's",
        date: "2026-11-07",
        lines: [
          {
            text: "ORG BANANAS",
            name: "Bananas",
            price: 1.31,
            quantity: 1.32,
            unit: "lb",
            onSale: false,
          },
        ],
      },
    });
  });

  it("turns a multi-buy into the price of one", () => {
    const parsed = parseReceiptAnswer(
      answer({
        lines: [
          line({
            text: "2 @ 3.49 PASTA",
            name: "Pasta",
            totalPrice: 6.98,
            count: 2,
            size: 16,
            sizeUnit: "oz",
          }),
        ],
      }),
    );
    expect(parsed.ok && parsed.receipt.lines[0]).toMatchObject({
      price: 3.49,
      quantity: 16,
      unit: "oz",
    });
  });

  it("uses 1 each when no size is printed, or the unit isn't one the app knows", () => {
    const parsed = parseReceiptAnswer(
      answer({
        lines: [
          line({ text: "AVOCADO", name: "Avocado", totalPrice: 1.29, size: null, sizeUnit: null }),
          line({ text: "CANDLE", name: "Candle", totalPrice: 4, size: 3, sizeUnit: "wicks" }),
        ],
      }),
    );
    expect(parsed.ok && parsed.receipt.lines.map((l) => [l.quantity, l.unit])).toEqual([
      [1, "each"],
      [1, "each"],
    ]);
  });

  it("drops lines without a name or with an impossible price", () => {
    const parsed = parseReceiptAnswer(
      answer({
        lines: [
          line(),
          line({ name: "" }),
          line({ totalPrice: 0 }),
          line({ totalPrice: -2 }),
          line({ totalPrice: 50000 }),
          { text: "BROKEN" },
        ],
      }),
    );
    expect(parsed.ok && parsed.receipt.lines).toHaveLength(1);
  });

  it("ignores an unreadable date", () => {
    const parsed = parseReceiptAnswer(answer({ date: "11/07/26" }));
    expect(parsed.ok && parsed.receipt.date).toBeNull();
  });

  it("keeps sale lines marked", () => {
    const parsed = parseReceiptAnswer(answer({ lines: [line({ onSale: true })] }));
    expect(parsed.ok && parsed.receipt.lines[0]?.onSale).toBe(true);
  });

  it("says when there's no receipt", () => {
    expect(parseReceiptAnswer(answer({ found: false, lines: [] }))).toEqual({
      ok: false,
      reason: "no_receipt",
    });
    expect(parseReceiptAnswer(answer({ lines: [line({ totalPrice: 0 })] }))).toEqual({
      ok: false,
      reason: "no_receipt",
    });
  });

  it("refuses replies that aren't the agreed shape", () => {
    expect(parseReceiptAnswer("not json")).toEqual({ ok: false, reason: "not_json" });
    expect(parseReceiptAnswer(JSON.stringify({ lines: "lots" }))).toEqual({
      ok: false,
      reason: "wrong_shape",
    });
  });

  it("caps what it keeps: 100 lines, 80 characters of text", () => {
    const many = Array.from({ length: 150 }, (_, i) =>
      line({ text: `ITEM ${i} ${"X".repeat(150)}` }),
    );
    const parsed = parseReceiptAnswer(answer({ lines: many }));
    expect(parsed.ok && parsed.receipt.lines).toHaveLength(100);
    expect(parsed.ok && parsed.receipt.lines[0]?.text.length).toBeLessThanOrEqual(80);
  });
});
