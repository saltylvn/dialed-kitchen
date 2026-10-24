# 0018. Calories and macros: per serving on recipes, totaled per person on the plan

**Status:** Accepted · 2026-10-23 · builds on 0016 and 0017

## Context

The owner wants each planned day to show calories and macros (protein, carbs, fat). Those numbers have to come from somewhere, and typing them for every recipe is tedious. The owner chose: **fill them automatically where possible, and always let us edit them.**

## Decision

- **Four optional values per serving on each recipe:** `calories`, `protein_g`, `carbs_g`, `fat_g`.
  - The database checks ranges: 0–5,000 kcal and 0–1,000 g.
  - They're saved in the same all-or-nothing step as the rest of the recipe: a new 9-argument `save_recipe` that wraps the existing one. The 8-argument version stays, so the app version running during a deploy keeps working.
- **Where the numbers come from**, in order of trust:
  1. **Typed by us**, always possible.
  2. **Website imports:** the page's schema.org `nutrition` data, read without AI (`lib/nutrition.ts` `nutritionFromSchemaOrg`).
  3. **Photo imports:** only if the page **prints** nutrition. The AI is told never to estimate there.
  4. **"Estimate with AI":** Gemini estimates per serving from the ingredients typed in the form.
     - It uses the same server-only caller, model fallback and checked JSON as photos (0016).
     - It counts against the same 40-a-day limit (`lib/server/aiLimit.ts`).
     - An estimate with any impossible value is refused outright.
     - It only fills the form; we check it and save.
- **On the Plan tab**, each day with meals has two native dropdowns (`<details>`): **Calories** and **Macros**.
  - The total shows on the closed row; inside is the meal-by-meal list.
  - Totals are **per person: one serving of each planned meal**, whatever the planned servings count.
  - **Totals never pretend:** meals without numbers are named ("Not counted yet: Snacks"), and nothing known shows "–", not 0 (`dayTotals`, tested).

## Alternatives considered

- **AI estimate for every recipe automatically, on save:** no typing, but silent guesses and quota use on recipes we may never plan. A button keeps it deliberate and visible.
- **A nutrition database lookup per ingredient (USDA API):** more exact in theory, but ingredient matching ("1 can black beans, drained") is a project of its own. Can be added later behind the same fields.
- **Storing totals per plan entry:** they'd go stale when a recipe's numbers change. Totals are computed from the recipe each time.

## Consequences

- Calories and macros appear as soon as a recipe has numbers, from any source.
- AI estimates are typical values, not lab numbers. The form says to check them.
- The Plan tab reads four more small columns per recipe.
