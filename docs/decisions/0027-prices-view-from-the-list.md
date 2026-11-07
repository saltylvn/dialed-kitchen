# 0027. The Prices view starts from the grocery list, grouped by store section

**Status:** Accepted · 2026-11-07

## Context

The Prices view (decision 0011) was an alphabetical price book: every item, with its best price as one line of small text. In the store, the questions are about what's on the list right now: "What's the best I've paid for this, and where?" and "Let me log what it costs here." Items that were on the list but not yet in the price book didn't appear at all, so there was no way to price them from this view. A long alphabetical list is also slow to scan compared to how a store is laid out.

## Decision

- **Everything on the grocery list comes first** ("On your list", in list order: still to buy, then checked), followed by the rest of the price book. Each item shows once, even if it's on the list twice.
- **Each row has a "Best price" box** on the right: the unit price, the store it was found at and the date, with Sale and Older spelled out as tags. The food emoji sits on the left of the name.
- **Each row has a Log price button.** For an item in the price book it opens the item's page at the price form (`#log-price`). For a list entry that isn't in the price book yet, it opens Add item with the name filled in; after adding, the page lands on the price form.
- **List entries match items by name as well as by link** (`lib/priceBook.ts`). An entry typed before its item existed isn't linked in the database (the app can't change `item_id` after insert). Matching the name, ignoring capitals and spaces (the same rule as adding to the list), lets it pick up the item's prices on both the Prices and List views without a migration.
- **Items are grouped into store sections**: Produce, Meat & seafood, Dairy & eggs, Bakery, Pantry, Snacks & drinks, Other (`lib/foodCategory.ts`). Like the emoji (decision 0023), the section is worked out from the name each time, using the same food word: mostly by its emoji (🥬 → Produce), with a short list of exceptions where an emoji covers two sections (yogurt shares 🥣 with oats; chili powder shares 🌶️ with jalapeños). Unknown names go to Other.

## Alternatives considered

- **A stored category per item, chosen when adding:** exact, and editable, but one more question on every add, a migration and a backfill. The name-based guess covers most groceries; a stored override can be added later with this function as the default.
- **Linking old list entries in the database** (a trigger when an item is added): keeps one source of truth, but needs a migration and changes what a list row means. The name match gives the same result on screen.
- **Logging the price in a sheet on the Prices view:** saves a page load, but needs the price form and its wheels as client code on the price book page. Linking to the existing form keeps this page server-rendered and small.

## Consequences

- In the store, the Prices view answers "where was this cheapest?" for exactly what you're buying, in roughly the order you walk the store.
- A wrong section guess only moves an item between headings; adding a word to `lib/foodEmoji.ts` or an exception to `lib/foodCategory.ts` (with a test) fixes it.
- Names the app doesn't recognize show no emoji and go to Other.
