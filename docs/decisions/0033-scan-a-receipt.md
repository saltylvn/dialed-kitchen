# 0033. Scan a receipt to log a whole trip's prices

**Status:** Accepted · 2026-11-08 · Builds on decisions 0016 (AI from photos) and 0032

## Context

The price comparison is only as good as the prices logged, and starting out means logging dozens of them. The owner asked for a way to read prices from a receipt, so getting started doesn't mean typing everything. Receipts are hard for a program to use directly:

- **Abbreviations:** "KS ORG EGGS 24CT", "CHKN THIGHS BNLS".
- **Weighed items:** "1.32 lb @ 0.99/lb".
- **Multi-buys:** "2 @ 1.29".
- **Lines that aren't groceries:** subtotal, tax, payment.

## Decision

- **Gemini reads the receipt** (`lib/ai/receiptFromImage.ts`, `readReceiptFromPhotos` in `lib/server/gemini.ts`), the same way as recipe photos (decision 0016):
  - Server-side only, one of the person's daily AI requests, and photos shrunk on the phone (2400 px for small print), checked by their bytes and never stored.
  - The instructions ask for the store, the date and one entry per item: the printed description, a plain name, the price, how many, and the weight or size. Totals, tax and payment are skipped.
  - The reply is untrusted. It's checked with zod and turned into **one package price per line**: a multi-buy "2 @ 1.29" becomes 1.29 each, and a weighed item is its total for its weight. Lines without a name or with an impossible price are dropped.
- **Each line gets a suggested item** (`suggestItem` in `lib/receipt.ts`), strongest evidence first:
  1. You matched this receipt text at this store before.
  2. Same name.
  3. Same main name.
  4. Every word of your item appears in the line, and both are the same food. So "Boneless Chicken Thighs" → "Chicken thighs", but "Milk chocolate" isn't "Milk".
  - Otherwise the line becomes a **new item** under its plain name. It never guesses an existing item it isn't sure of.
- **The store is recognized** from the header ("TRADER JOE'S #123" → Trader Joe's) and shown on the store wheel (decision 0032), where you can change it.
- **Nothing is saved until you review it.** The review screen shows each printed line with its item (pick another, make a new one, or "Don't save"), the price for one, the size, and sale.
  - If a line goes to an item priced another way (an "each" for an item priced per lb), the unit switches to the item's and the line says "check the size", rather than saving something the database would refuse.
- **Saving** (`saveReceipt`) is checked with the same rules as a typed price (`priceFormSchema`):
  - First it creates any new items (or reuses one with the same name).
  - Then it inserts **all the prices in one insert**, so they're saved together or not at all.
  - Then it remembers each receipt text.
- **Remembered matches** live in a new table, `receipt_aliases` (household, store, receipt text → item):
  - Household RLS and per-column grants.
  - The text is stored in one canonical form (capitals, single spaces, without the weight, multi-buy and price that change every trip; `receiptKey`), enforced by a check constraint.
  - A match is forgotten when its item or store is deleted (cascade).
- **Tested** with unit tests (parsing, matching, text cleaning, store detection), database tests (the table's rules, including the exact upsert the app sends), and a real-Gemini test on a drawn receipt that's kept out of CI (`NETWORK_TESTS=1`, `lib/server/gemini.network.test.ts`).

## Alternatives considered

- **On-device text recognition (OCR) plus our own parsing:** free and private, but every store's receipt layout is different, and turning "CHKN THIGHS BNLS 2.10 lb @ 3.49/lb 7.33" into an item, weight and price is exactly what the AI does well.
- **Saving straight away, without review:** faster, but a wrong match would quietly put prices under the wrong item. The review is quick when the suggestions are right, and they improve as matches are remembered.
- **One database function to save everything:** fully atomic, but more SQL to maintain. Prices go in one all-or-nothing insert. If that fails after new items were created, those items stay without prices, which is harmless (you just see them in the price book).
- **Price wheels on every review line:** the app's usual way to pick a number, but twenty lines of wheels is slow. These prices arrive already filled in, so typed boxes are used for corrections.

## Consequences

- One photo can add a whole trip's prices, and new items, to the price book.
- Each store's receipts get faster to review as matches are remembered.
- Costs one AI request per scan (40 a day; 10 for the demo).
