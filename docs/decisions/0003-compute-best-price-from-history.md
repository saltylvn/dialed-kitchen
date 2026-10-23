# 0003. Compute best price from price history instead of storing it

**Status:** Accepted · 2026-10-22

## Context
The owner shops at several stores and wants to see the best price found so far for each item while shopping. Package sizes differ (a 2 lb bag vs a 5 lb bag), and prices change, get mistyped, edited and deleted.

## Decision
- Store every price as an immutable-by-default row in `item_prices` (item, store, price, package quantity and unit, date, sale flag).
- Compare prices by **unit price**, in one comparison unit per item (per lb, per fl oz, or each). The math lives in `lib/pricing.ts` with unit tests.
- **Compute** the best price (lowest unit price) from the history when it's needed, with a database index on `(user_id, item_id)` to keep it fast. Don't store a "best price" column.

## Alternatives considered
- **A `best_price` column on `items`, updated on each new price:** fast to read, but it goes wrong when a price is edited or deleted (the old best has to be found again), and two sources of truth can disagree.
- **Compare sticker prices:** simpler, but misleading whenever package sizes differ.

## Consequences
- Editing or deleting a price can never leave a stale best price behind.
- The full history also supports later features: trends, "cheapest store", "last price at this store".
- Each read does a small aggregate query; at personal-app scale (thousands of rows), an index makes this effectively instant. If it ever weren't, a database view or materialized view could be added without changing the app's logic.
