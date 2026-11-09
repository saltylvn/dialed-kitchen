# 0035. Grocery list and In stock; prices in the price book

**Status:** Accepted · 2026-11-09 · Replaces the Shopping kart and row prices of decision 0034

## Context

After using the all-in-one page (decision 0034), the owner asked for something simpler:

- **Two lists, not three:** Grocery list and In stock. Ticking an item means you've got it, so it should go straight In stock.
- **No prices on the grocery list.** Prices belong in the price book. Each grocery item gets a **Price book** button that goes to that item's prices.
- **The ways into prices as rows:** Price book, Scan a receipt, Log a price.
- **No add box at the top** of the Grocery tab.
- **The price book shouldn't show the three fixed stores** (WinCo, Trader Joe's, Harmons). Logging prices at different stores stays in the price book.
- **Receipts by camera only**, no uploads, to keep it simple.
- **Wheels:** taller and faster to scroll, with store and price side by side.

## Decision

- **The Grocery tab, top to bottom:**
  - **The price rows:** Price book, Scan a receipt, Log a price. Each is a full-width row with a one-line hint.
  - **The Grocery list:** grouped by store section, with the add box at its end.
  - **In stock.**
- **Ticking moves an item In stock** (`set_in_stock`, which already takes it off the list).
  - A **"✓ Avocado is In stock · Undo"** line appears, and Undo takes it back out of In stock and puts it on the list with its amount.
  - **×** takes an item off the list.
  - The Shopping kart, the Log sheet, `setChecked` and `clearCheckedIntoStock` are gone. Entries left ticked from the kart show on the list again, so nothing disappears.
- **Grocery rows show no prices**, so the list query no longer reads store prices.
  - A row is checkbox, item, **Price book**, ×.
  - **Price book** opens `/grocery/prices?item=<id>#item-<id>`: the page scrolls to that row and outlines it. The address names the item because the browser's own `:target` highlight doesn't apply when the app moves between pages without reloading.
  - For an item that isn't in the price book yet, the button opens Add item with its name filled in.
- **Price book rows:** item, **Log** (the item's price form, with the store wheel), and the **best price** with its store and date. The fixed three-store column and its code (`MAIN_STORES`, `mainStorePrices`, `StorePrices`) are removed. Every store's latest price is still on each item's page.
- **Log a price** (`/grocery/log`): pick the item (a native menu, which iPhone shows as a wheel), then the usual form, starting at that item's last price. `?item=` preselects an item.
- **Scan a receipt is camera only.**
  - The input uses `capture="environment"`, which opens the rear camera with no photo library option, one photo at a time.
  - A long receipt takes up to 3 shots ("Long receipt? Take the next part"), then one **Read the receipt**.
- **Wheels:**
  - The store and price wheels show **5 rows** instead of 3, and sit **side by side** in the price form.
  - Rows no longer force a stop at each value (`snap-always` removed), so a flick glides past many prices and settles on the nearest.

## Alternatives considered

- **Keeping the Shopping kart:** it separated "in the cart" from "at home", but the owner treats ticking as "got it", and the extra list was one more thing to manage.
- **Showing the three stores in the price book:** the earlier way to compare at a glance. The owner found it didn't work as hoped, so the best price is shown instead, and each item's page lists every store.
- **Allowing receipt uploads too:** useful for receipts photographed earlier, but two paths for one job. The camera keeps it to one.

## Consequences

- The Grocery tab is a simple to-do list beside your kitchen inventory, with prices one tap away.
- A mis-tick is undone with one tap. After leaving the page, the item is still in In stock and can be re-added.
- Receipts photographed before can't be scanned. Take a new photo of the paper receipt.
