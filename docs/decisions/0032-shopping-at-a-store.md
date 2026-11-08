# 0032. Shopping at a store: compare your stores on the list, and log prices as you check off

**Status:** Accepted · 2026-11-08 · Builds on decisions 0011, 0027 and 0031

## Context

The owner shops at three stores (Trader Joe's, WinCo, Harmons) and wants the shopping list and the price comparison in one place. A review of the Grocery tab found two problems:

- **The comparison lived on Price Tracker**, a different screen from the list you shop from. The list showed only "Last here" and "Best".
- **Logging a price took about seven steps** (Price Tracker, the item, scroll, store, price, package size, Save). Few prices would get logged in a store, and the comparison is only as good as the prices logged.

The "Shopping at" menu also listed six stores and forgot the choice between visits.

## Decision

- **"Shopping at" is your three stores as big buttons**, with the other stores in a menu. The choice is **remembered on this phone** in a cookie, so each partner's phone keeps its own:
  - `httpOnly`, `sameSite=lax`, kept for half a year.
  - It holds only a store id, which the page checks against the household's own stores before using it.
  - It's set by a server action, so the updated list comes back in the same round trip.
  - Tapping the chosen store again clears it.
- **Each list item compares your stores** (`compareHere` in `lib/mainStores.ts`, unit tested):
  - In a store: "Here $2.49 per lb · WinCo $1.99 ↓ 20% less", or "✓ Cheapest here", or "No price here yet · WinCo $1.99 per lb".
  - Not in a store: your stores' prices, cheapest first.
  - Words always carry the meaning, never color alone.
  - All of it comes from one read of the latest price at every store (`item_latest_store_prices`), in the same parallel batch as the list.
- **Checking an item off in a store opens a quick price log** (`QuickLogSheet`), a bottom sheet built on the native `<dialog>` (focus moves in, the page behind is inert, Escape closes it):
  - The **store wheel** starts at the store you're at.
  - The **price wheels and package size** start at the last price logged there, or else the most recent price anywhere.
  - The **date** is today.
  - So an unchanged price is one tap: **Save**. **Skip** closes it and the item stays checked.
  - It saves through the same `logPrice` action as the item page, so validation, RLS and the "🎉 New best price!" message are the same. The message appears above the list.
- **The store in every price form is a swipe wheel**, like the price (`StoreWheel`): Trader Joe's, WinCo, Harmons, Smith's, Walmart (`LOG_STORES`).
  - It starts at Trader Joe's, or at the store you're shopping at.
  - A store you're at that isn't on the wheel (Costco) is added at the end.

## Alternatives considered

- **The store in the URL (`?store=`), as before:** works without cookies, but it's forgotten whenever the app is reopened from the home screen.
- **Remembering the store in the database:** it would follow you between devices, but the two partners could be in different stores at once. Which store you're in belongs to the phone.
- **Detecting the store by location:** automatic, but it needs location permission, store coordinates and a fallback anyway. It could be added later on top of this.
- **Asking for a price on every check-off, even when not in a store:** you also check things off at home. The sheet appears only when a store is chosen and the item is in the price book.

## Consequences

- In a store, the list answers "is this cheaper elsewhere?" for each item, and the price history grows from normal shopping.
- One more round trip only when the store changes, and none when checking off.
- Items not in the price book don't get the sheet. They can be added from Price Tracker, or by scanning a receipt (next).
