# 0019. From the meal plan to the grocery list, with an estimated cost

**Status:** Accepted · 2026-10-23 · builds on 0010, 0014 and 0017

## Context

Planning the week should build the shopping list: add up what the meals need, skip what's already in the kitchen, and say roughly what it'll cost. The numbers must be right (no doubled onions, no guessed conversions), and the Plan card and the list must always agree.

## Decision

- **One database function works out the week, `week_shopping(week_start)`**, and everything else uses it:
  - Each recipe's ingredients are **scaled to the servings planned** (planned ÷ recipe servings).
  - The same ingredient is **combined across meals** by the shared name rule (`private.ingredient_key`, as for In stock). Units of the same kind are converted (cups + tbsp, lb + oz) and shown in the unit used first.
  - Amounts that can't be combined stay on **separate rows**: a bare number ("2 onions"), no amount ("salt to taste"), or a different kind of measure (1 cup vs 4 oz of spinach). Never guessed.
  - Each row says whether it's **In stock** or **already on the list**.
  - **Estimated cost** = amount × the price book's **best** unit price, only when the units convert (a bare count prices against a per-each price). Otherwise it's left out, and the card says how many items aren't priced.
- **`add_week_to_list(week_start)`** inserts every row that isn't In stock or already on the list, marked `source = 'meal_plan'`, in one statement. Running it twice adds nothing.
- Both functions are `security invoker`, so RLS limits them to the caller's household.
- **On the Plan tab**, a "This week's groceries" card sits above the days. It shows the count (ingredients · In stock · on your list), the estimated cost at your best prices, and **Add N to grocery list**. The counts and cost are summed by `lib/weekShopping.ts` (tested; money summed in cents).

## Alternatives considered

- **Adding up in TypeScript and inserting a list:** the same rules would live in two places (the card's estimate in TS, the insert in SQL) and could drift. One SQL function is the single source of truth, and adding is one round trip.
- **Adding to existing list entries' amounts** (topping up "1 lb pasta" to "3 lb"): the list entry may be for something else, or partly bought. Skipping what's already on the list matches "Add recipe to list" (0014) and is predictable.
- **Latest price instead of best price:** the latest is closer to what you'll pay at one store. The best price matches the price book's headline number and the "plan your cheapest week" goal. It's labeled "at your best prices".
- **Treating singular and plural as the same** ("onion" vs "onions"): not done, to keep one name rule app-wide. Possible later in `ingredient_key` (and `matchKey`) together.

## Consequences

- A planned week reaches the list in one tap, with amounts that respect servings.
- The cost is an estimate: unpriced items and unit mismatches are left out and counted, never filled in.
- Names must match to combine: "onion" and "onions" stay separate lines.
