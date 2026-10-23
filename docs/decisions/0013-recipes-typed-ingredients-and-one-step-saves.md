# 0013. Recipes: ingredients typed as text, saved in one step, cooked from in place

**Status:** Accepted · 2026-10-23

## Context

Recipes come from websites, cookbooks, magazines and the couple's own cooking. Entering ingredients as separate amount, unit and name fields per row is slow on a phone. People, and recipe websites, write ingredients as lines of text: "1 1/2 cups flour". A recipe is also used in two very different ways: browsing the box, and cooking from it with messy hands.

## Decision

- **Ingredients are typed one per line, and read by `lib/ingredients.ts`:**
  - Amounts: whole numbers, decimals, fractions (`1/2`), mixed numbers (`1 1/2`), unicode fractions (`½`, `1½`), and ranges (the low end).
  - Units: common spellings and abbreviations, including `T` for tablespoon and `t` for teaspoon.
  - Anything it doesn't recognize stays in the name ("2 cloves garlic"); nothing is guessed. The edit form writes lines back in the same form (tested round trip).
  - Website import (Milestone 5) will use the same reader, since schema.org recipes list ingredients as text.
- **Kitchen units cup, tbsp and tsp join the volume units**, with exact conversions (in TypeScript and SQL; the agreement test covers them). Amounts display as kitchen fractions (½, 1½, ⅓), with singular units for one or less ("½ cup", "2 cups").
- **Ingredients link to the price book** by name, using the part before any comma ("Chicken thighs, boneless" → Chicken thighs), so the meal planner can price recipes later.
- **One-step saves:** `save_recipe` (a `security invoker` Postgres function, so RLS and grants apply as for any write) creates or updates the recipe and replaces its ingredients in one transaction. Either everything saves or nothing does.
- **Add to grocery list:** `add_recipe_to_list` inserts all ingredients in one statement, skipping linked items already on the list (`on conflict … do nothing` on the list's partial unique index).
- **Favorites:** a shared ★ flag. Favorites show first, then the rest. Once the meal planner exists, favorites can also sort by how often they're planned.
- **Cook in place:** tapping a recipe expands it (one open at a time) with ingredients, numbered steps you tap to mark done, "Add to grocery list", Edit, and a **Keep screen on** switch (the Screen Wake Lock API, re-acquired when the app returns to the foreground).

## Alternatives considered

- **A row of fields per ingredient:** precise, but slow to enter and edit on a phone.
- **Saving the recipe, then each ingredient, from the app:** several requests that could half-succeed and leave a recipe with missing ingredients.
- **A separate page per recipe:** an extra tap and a back-and-forth while cooking. Expanding in place keeps the list and the recipe together.

## Consequences

- Ingredient lines with unusual units keep the unit as text, so they can't be priced or combined automatically. They're listed separately rather than guessed (see Milestone 8).
- Step progress is per phone and resets when the page reloads, which is right for a one-time cooking session.
