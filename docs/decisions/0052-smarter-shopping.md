# 0052. Smarter shopping: today's cheapest price, a By store list, restock from receipts

**Status:** Accepted · 2026-11-21 · Changes what the grocery list and the week's cost use from 0019 and 0035; the best-price rule (0003) stays for the price book

## Context

The grocery list's "Best" price and the week's estimated cost both used the **lowest price ever** entered. An old Costco sale or a WinCo price from eight months ago could make the week look cheaper than it is, and point the shopper to a store that is no longer cheapest. The data to fix it already existed: each store's latest price (`item_latest_store_prices`).

Two more gaps from the three-agent review (0050): when shopping at two stores, you had to read every row to work out what to buy where; and after scanning a receipt, the same purchases still had to be ticked off the list by hand.

## Decision

- **"Cheapest now"** (`item_cheapest_now`, a database view): for each item, every store's most recent price, then the lowest of those, with its store and date.
- **The grocery list** shows it on each row ("Cheapest · $1.49/lb · Costco"), marked "older" when that price is over 90 days old.
- **The week's estimated cost** (`week_shopping`) uses it too, so the budget reflects today's prices. The function's return type is unchanged, so "Add to grocery list" works as before.
- **The best price ever** stays where it means something: the price book, an item's page and "🎉 New best price!".
- **By store view:** a Section / Store toggle on the grocery list.
  - Store groups the list under the store where each thing is cheapest now, in the fixed store order, with "Anywhere" for things never priced.
  - Each store shows a count and an estimated subtotal (`lib/shopTrip.ts`). The estimate covers only the amounts that convert to the price's measure, and it says how many weren't priced; it never guesses.
- **Restock from a receipt:** saving a receipt puts everything on it In stock and takes the matching entries off the grocery list, in one database step (`restock(names)`, security invoker, so row-level security applies as for a tap).

## Alternatives considered

- **Keep the best price ever everywhere.** Simpler, but it answers "what's the lowest I've ever paid?" when the shopper is asking "where should I buy this today?".
- **The latest price at any store** (ignoring the others). Recent, but not cheapest; it would point to wherever you shopped last.
- **Ask before restocking after a receipt.** One more tap on every trip, for a case (bought it but don't have it) that doesn't happen.
- **Saving the By store choice per person.** Not needed yet: the toggle starts on Section and is one tap.

## Consequences

- The estimated cost may go up for items whose best price was an old sale; that's the point.
- The price book and the list can now show different prices for the same item (best ever vs cheapest now). Their labels say which.
- Scanning a receipt now changes In stock and the grocery list, not just prices. The success message says how many things came off the list.
