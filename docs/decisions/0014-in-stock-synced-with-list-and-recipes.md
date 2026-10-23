# 0014. "In stock": one kitchen inventory, kept in step with recipes and the grocery list

**Status:** Accepted · 2026-10-23

## Context

The couple wants the grocery list to show only what they actually need to buy. Recipes should show which ingredients are already in the kitchen and which are needed. Marking something as in the kitchen anywhere should be reflected everywhere: on the recipe and on the list. The owner's word for it is **In stock**.

## Decision

- **One shared inventory** (`pantry_items`): a row means "In stock" for the household.
  - Entries are matched by name with one rule, `private.ingredient_key` in SQL and `matchKey` in TypeScript (a test checks they agree): lowercase, the part before any comma or bracket. So "Chicken thighs, boneless", "chicken thighs" and a price-book item "Chicken thighs" are the same thing.
  - The key is a generated column with a unique index per household, so it can't be set wrong or duplicated.
- **Every sync happens inside the database, in one step** (`security invoker` functions, so RLS applies):
  - `set_in_stock(name, true)` records it **and** removes matching not-yet-bought entries from the grocery list. `set_in_stock(name, false)` is "Used up".
  - `clear_checked_into_stock()`: after shopping, the bought (checked) entries leave the list and become In stock.
  - `add_recipe_to_list` adds only what's needed:
    - It skips In stock ingredients and anything already on the list waiting to be bought (by the same name rule).
    - It adds an ingredient a recipe names twice only once.
- **Screens:**
  - Each recipe ingredient has an **In stock** box, with a "N needed · M In stock" summary and "Add N needed to list".
  - Each list entry has an **In stock** button.
  - The Grocery tab gains an **In stock** view (List · In stock · Prices) with **Used up** and a way to add items.

## Alternatives considered

- **An `in_stock` flag on price-book items:** simpler, but plain-text ingredients ("fresh parsley") couldn't be In stock.
- **Syncing in app code** (mark In stock, then separately delete from the list): two requests that could half-succeed and leave the tabs disagreeing.
- **Hiding In stock items from the list instead of removing them:** the list would grow with invisible entries, and "show me what to buy" would depend on a filter rather than the data.
- **Marking items In stock the moment they're checked off:** a mis-tap would change the inventory. Clearing checked items is a deliberate "I'm done shopping".

## Consequences

- The Recipes and Grocery tabs can't disagree: they read the same rows, and every change is one transaction.
- Matching by name is simple and predictable, but it's literal: "cheddar" and "shredded cheese" are different things. Linking ingredients to price-book items keeps names consistent.
- Quantities aren't tracked ("2 of 3 eggs left"); In stock is yes or no, which fits how a household actually shops.
