import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readReceiptFromPhotos } from "./gemini";

// Real Gemini checks (docs/decisions/0033). Not part of CI: they need GEMINI_API_KEY and the
// free tier can be busy. Run with: NETWORK_TESTS=1 npx vitest run lib/server/gemini.network.test.ts
// (reads the key from .env.local). The receipt is a drawn test receipt, test/fixtures/receipt.jpg.
describe.skipIf(!process.env.NETWORK_TESTS)("Gemini on the real internet", () => {
  it("reads a Trader Joe's receipt line by line", { timeout: 60_000 }, async () => {
    process.loadEnvFile(".env.local");
    const photo = new Uint8Array(readFileSync("test/fixtures/receipt.jpg"));
    const result = await readReceiptFromPhotos([photo]);
    if (!result.ok) throw new Error(`Gemini said: ${result.reason}`);
    const { receipt } = result;
    console.log(JSON.stringify(receipt, null, 2));

    expect(receipt.storeName).toMatch(/trader joe/i);
    expect(receipt.date).toBe("2026-11-07");
    // Five things bought; subtotal, tax, total and payment skipped.
    expect(receipt.lines).toHaveLength(5);
    const line = (text: RegExp) => receipt.lines.find((l) => text.test(l.text));
    expect(line(/BANANA/)).toMatchObject({ price: 1.31, quantity: 1.32, unit: "lb" });
    expect(line(/PASTA/)).toMatchObject({ price: 1.29, quantity: 16, unit: "oz" }); // 2 @ 1.29
    expect(line(/CHKN/)).toMatchObject({ price: 7.33, quantity: 2.1, unit: "lb" });
    expect(line(/ONION/)?.price).toBe(0.49);
  });
});
