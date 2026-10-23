# 0011. One shared grocery list per household, with instant check-offs

**Status:** Accepted · 2026-10-23

## Context

The grocery list is used in the store, one-handed, often on weak cellular signal, and by both partners. It needs to be simple to reach, fast to tick off, and to show the prices from the price book (decisions 0003, 0010) where they help: the best price, and the last price at the store you're in.

## Decision

- **One list per household** (`grocery_list_items`, household RLS like everything else). No named or multiple lists: both partners always see "the list", and the meal planner (Milestone 8) adds to the same one.
- **An entry is either linked to a price-book item or plain text.**
  - Adding text that matches an item's name (ignoring capitals) links it, so the list shows its best price and, once you choose a store, the last price there.
  - If the item is later deleted, the entry stays as text: the foreign key uses `on delete set null (item_id)`, a Postgres 15+ feature that clears only that column.
- **A linked item can be on the list only once while unchecked** (partial unique index). Adding it again says "already on the list".
- **Checked items stay until "Clear checked"**, sorted below the items still to buy. The database stamps `checked_at` from `checked` (trigger), so the app only flips one column.
- **"Last price at this store"** is a `security_invoker` view (`item_latest_store_prices`) over an index on `(store_id, item_id, observed_on desc)`. The chosen store lives in the URL (`?store=`), so the page is rendered on the server with that store's prices.
- **Optimistic UI** for check, uncheck and remove (`useOptimistic`): the screen changes on tap, the save happens in the background, and a failed save puts the screen back with a message.
- **The Grocery tab has two views**, List (`/grocery`) and Prices (`/grocery/prices`, the price book), switched at the top.

## Alternatives considered

- **Multiple named lists** ("Costco", "This week"): more flexible, but more taps and decisions in the store, and a reason the two partners might look at different lists.
- **Deleting items as they're checked:** fast, but no undo for a mis-tap, and no record of what you just bought.
- **Live updates between partners' phones** (Supabase Realtime): would need the database client in the browser (decision 0007). For now each phone refreshes on navigation and after every change. It can be added later behind its own decision.

## Consequences

- Checking items off feels instant even on a slow connection.
- The list and the price book refresh together (`revalidatePath("/grocery", "layout")`).
- The store choice isn't remembered between visits yet. It's picked once per trip.
