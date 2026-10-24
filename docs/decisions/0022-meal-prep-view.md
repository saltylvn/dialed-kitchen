# 0022. A meal-prep view: batch cook and prep once

**Status:** Accepted · 2026-10-23 · builds on 0017 and 0019

## Context

Weekly meal prep means cooking a recipe once for several meals, and washing, chopping or cooking shared ingredients together. The plan already holds that information; it needed a view. The amounts had to match the grocery list exactly.

## Decision

- **A Meal prep page** (`/plan/prep?week=<Monday>`), linked from the "This week's groceries" card, with two sections:
  - **Batch cook:** recipes planned more than once that week, with the planned servings added up ("Cook 8 servings at once") and which days and meals they're for.
  - **Prep once:** ingredients with an amount that two or more planned meals use, with the week's total and where each is used ("3 cups rice · Mon dinner (Rice bowl) · Tue lunch (Fried rice) · …"). Lines with no amount, like "salt to taste", are left out.
- **Same numbers as the grocery list:** `week_shopping` (0019) now also returns `uses`: each planned meal that needs the ingredient, in week and meal order. Changing a function's return type means recreating it, so both `week_shopping` and `add_week_to_list` are recreated with otherwise identical rules. The live app's code ignores the extra column, so nothing breaks mid-deploy.
- Meals now sort in meal order (breakfast, lunch, snacks, dinner) rather than alphabetically wherever the week is ordered.
- The pure rules (`batchRecipes`, `sharedIngredients`, labels) are in `lib/mealPrep.ts` with tests; the page is a server component (no JavaScript sent).

## Alternatives considered

- **Working out shared ingredients in TypeScript from the recipes:** a second copy of the combining and unit rules that could drift from the grocery list.
- **A separate `week_prep` SQL function:** the same grouping duplicated in SQL. Extending one function keeps one source of truth.
- **Step-by-step prep instructions** ("start the rice, then chop onions"): that needs timing data recipes don't have, and is mostly guessing. The view sticks to facts from the plan.

## Consequences

- A planned week shows at a glance what to cook in bulk and what to prep together.
- The same name-matching rule applies: "onion" and "onions" are separate lines (0019).
