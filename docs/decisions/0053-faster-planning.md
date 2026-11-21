# 0053. Faster planning: repeat a week, leftovers, plan from what's In stock, a weekly budget

**Status:** Accepted · 2026-11-21 · Builds on 0017 (meal plan) and 0019 (plan → grocery list)

## Context

Planning a week meant filling up to 28 spots one at a time: a picker, a servings wheel, save. There was no way to reuse last week, no way to say "Sunday's chili covers Monday's lunch", nothing pointing at what you could cook from what you already have, and no number to plan the week's groceries against.

## Decision

- **Repeat last week:** one button on Plan copies last week's meals into this week, day for day (`copy_plan_week`). Anything already planned (same day, meal and recipe) is skipped, so it's safe to tap twice or to use on a half-planned week.
- **Leftovers:** a planned meal has **Leftovers**, which plans the same recipe on a later day this week (`plan_leftovers`), shown as "Leftovers · Serves 2".
  - A new column, `meal_plan_entries.leftover_of`, links the leftovers back to the meal. Its composite foreign key keeps the link inside the household.
  - The leftovers' servings still count toward the week's groceries: you cook once, enough for both, so the shopping math was already right. The link is there so you know not to cook it again.
  - If the original is removed, the leftovers stay as an ordinary planned meal.
  - Copying a week copies leftover links too, pointing at the new week's meals.
- **Plan from what's In stock:** the recipe picker says how many of each recipe's ingredients are In stock ("Chili · 4 of 5 in stock"), matched the same way as the recipe box.
- **A weekly budget:** one optional amount per household (`households.weekly_budget`), set on a wheel in Settings and shared by the couple.
  - "This week's groceries" shows "$142 of $160 · ✓ within budget" or "· $12 over budget", in words as well as color.
  - It is written only through `set_weekly_budget`, because members can't otherwise update their household row.

## Alternatives considered

- **Leftovers that don't add ingredients** (with the original's servings raised instead). This means two numbers to keep in step, and forgetting one under-buys. Counting the leftovers' own servings is the same total with nothing to remember.
- **Copy a single day.** Useful, but less often than a whole week; it can reuse the same function later.
- **Sorting the picker by what's In stock.** That would fight the favorites-and-regulars order people already know. Labeling each recipe gives the information without reordering.
- **A per-person budget.** Groceries are bought for the household, so the budget is the household's.

## Consequences

- A repeated week can be undone meal by meal (×), not in one step.
- The picker reads every recipe's ingredients and the In stock list. That's two more reads per Plan load, made in parallel with the rest.
- The budget compares the estimate (at today's cheapest prices, 0052) with the budget, so unpriced ingredients aren't included; the card already says how many aren't priced.
