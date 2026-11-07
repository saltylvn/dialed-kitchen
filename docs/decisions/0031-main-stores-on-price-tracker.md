# 0031. Your three main stores on every Price Tracker row

**Status:** Accepted · 2026-11-07

## Context

The owner shops at three stores most of the time: Trader Joe's, WinCo and Harmons. On the Price Tracker the question is "which of my stores is cheapest for this right now?", but each row showed only the single best price ever found, which is often at a store they rarely visit, or an old sale.

## Decision

- **Each row's right-hand box lists the three main stores** with the price last logged at each (the `item_latest_store_prices` view, decision 0011), **cheapest first** and marked ✓ (`rankStores` in `lib/mainStores.ts`). Stores with nothing logged show "—" and go last, in the household's order.
- **The unit is shown once** in the box heading ("Your stores · per lb"), and each price is just the amount (`formatUnitAmount`), so a store and its price fit on one line on a phone.
- **The best price ever stays visible** when it beats all three (for example a Costco price or an old sale), as a "Best $0.998 · Costco · Oct 29" line under the stores. The item page still has every store and the full history.
- **The default three are Trader Joe's, WinCo, Harmons** (`MAIN_STORES`), named the same way as the fixed store list (decision 0012). One more parallel read on the Price Tracker gets the latest price at each store; it has at most six rows per item.

## Alternatives considered

- **All six stores on each row:** complete, but too tall for a list scanned in the store.
- **Only the best price (as before):** one number, but not the one that decides which of your usual stores to go to.
- **Choosing the three stores in Settings now:** the obvious next step. It needs a per-household setting (a migration) and a picker, so it gets its own change. The default covers the owner today.

## Consequences

- Each row answers "where should I buy this, of the places I go?" at a glance.
- Rows without prices at the main stores show dashes until prices are logged there.
- Changing which stores count as "main" means editing `MAIN_STORES` until the Settings picker exists.
