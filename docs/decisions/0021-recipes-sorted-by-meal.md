# 0021. Recipes sorted by meal, and a picker that only offers that meal

**Status:** Accepted · 2026-10-23 · builds on 0013 and 0017

## Context

The owner asked for recipes sorted by meal (Breakfast, Lunch, Snacks, Dinner), so the Plan picker only offers fitting recipes: tapping a Breakfast spot shouldn't scroll past lasagna. About twenty recipes already exist with no meal.

## Decision

- **`recipes.meals`:** a list of any of the four meals, possibly more than one (a soup can be lunch and dinner).
  - A `check` constraint allows only those four names.
  - Saving stores them in meal order, each once.
  - Empty means **Not sorted yet**; that's where existing recipes start.
  - It's saved with the rest of the recipe in one transaction (a 10-argument `save_recipe` that wraps the 9-argument one; older versions stay for the app running during a deploy).
- **Recipe form:** four meal chips, real checkboxes underneath. Chosen chips fill with the accent and show a ✓, never color alone.
- **Recipes tab, by meal:**
  - Sections in the fixed order, then Not sorted yet; favorites and regulars first within each (`lib/plan.ts` `groupByMeal`, tested).
  - A recipe for two meals appears in both, so "open" is tracked per section.
  - **Quick sort:** each unsorted card shows the four chips and a "Save to Lunch & Dinner" button, so twenty recipes sort in a minute without opening each one (`setRecipeMeals`, a plain update under RLS).
- **Plan picker:** a spot lists only that meal's recipes (favorites and regulars first), then **Not sorted yet** at the bottom, so no recipe is ever impossible to plan. A meal with no recipes says how to tag one.

## Alternatives considered

- **One meal per recipe:** simpler, but forces a false choice for dishes eaten at lunch or dinner.
- **A filter (All · Breakfast · …) instead of sections:** one card per recipe, but the owner asked for recipes _sorted_ by meal, and sections show everything at a glance.
- **Hiding unsorted recipes from the picker:** cleaner lists, but existing recipes would vanish from planning until sorted.
- **AI guessing each recipe's meals:** possible later; tagging is quick by hand and costs no AI quota.

## Consequences

- Planning a spot shows a short, relevant list.
- Existing recipes need a one-time sort; the quick-sort chips make that fast.
