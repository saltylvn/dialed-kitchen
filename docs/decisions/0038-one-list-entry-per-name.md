# 0038. One grocery list entry per name

**Status:** Accepted · 2026-11-09 · Builds on decisions 0011 and 0014

## Context

The owner doesn't want the same thing on the grocery list twice. The database only kept _linked_ entries unique (one unticked entry per price-book item, decision 0011). Typed names could repeat: "Bananas" and "bananas", or "Chicken thighs" and "chicken thighs, boneless".

Since decision 0035 there's no Shopping kart: ticking moves an item In stock. Entries ticked into the old kart were still stored as ticked and shown on the list. The In stock and recipe functions only look at unticked entries, so ticking one of those leftovers wouldn't have taken it off the list.

## Decision

- **A unique index on the name key:** `(household_id, private.ingredient_key(name))` on `grocery_list_items`. This is the same "same thing" rule In stock and recipes use: lowercase, and only the part before a comma or bracket.
  - "Bananas", "bananas" and "Bananas, ripe" are one entry; "Banana bread" is another.
  - It applies whether or not an entry is ticked, and the database enforces it, so even a partner adding at the same moment can't make a duplicate. The app already shows a refused duplicate as "Bananas is already on the list".
  - It replaces the old non-unique index on the same expression.
- **The migration cleans up existing data first:**
  - **Duplicates are merged:** the entry linked to the price book is kept, otherwise the oldest. Amounts aren't added together.
  - **Ticked leftovers from the Shopping kart are un-ticked**, so marking them In stock works like any other entry.
- **Tests:**
  - The rule: case, comma and bracket variants are refused; different things and other households are allowed.
  - Recipe adds still only add what's missing.
  - The clean-up, run on data loaded _before_ the migration: `createTestDb({ stopBefore })`, then `migrateRest()`.
  - Two older tests that allowed re-adding a ticked item now expect it to be refused.

## Alternatives considered

- **Checking only in the app before adding:** simpler, but two phones adding at the same moment could both pass the check. The database rule can't be raced.
- **Adding amounts together when merging duplicates** ("2 lb" + "1 lb"): nicer when the units match, but guesswork when they don't (decision 0010 never guesses conversions). Keeping one entry is predictable, and amounts can be edited.

## Consequences

- The list never shows the same thing twice, however it was added: typed, from a recipe, from the meal plan, or by Undo.
- Adding something already on the list shows a message instead of a second row.
- When the migration runs, any existing duplicate entries are merged into one.
