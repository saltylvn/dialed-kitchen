# 0017. The weekly meal plan: four fixed spots a day, shared by the couple

**Status:** Accepted · 2026-10-23 · builds on 0009 and 0013

## Context

The plan is the heart of the app: pick what to cook this week, then (Milestone 8) build the grocery list from it. It has to be quick to fill in on a phone, shared by both partners, and it should teach the recipe box which recipes the couple actually makes.

## Decision

- **Weeks run Monday to Sunday**, chosen with ‹ › arrows and `?week=<Monday>` in the address. The server can't know the phone's time zone, so the phone decides "this week": the Plan tab link adds `?week=` from the phone's clock (one trip, no redirect), and opening `/plan` without it (the home-screen icon) moves to this week in the browser. A "This week" button appears when looking at another week; today is outlined and marked "Today" (never color alone).
- **Every day shows four fixed spots, in this order: Breakfast, Lunch, Snacks, Dinner** (the owner's request). Tap an empty spot to choose a recipe and servings with swipe wheels (native `<select>`, shown as a wheel on iPhone). The recipe picker lists favorites and regulars first. Servings start at the recipe's own number.
- **One table, `meal_plan_entries`** (date, meal, recipe, servings), owned by the household like everything else:
  - RLS: only the couple can see or change it.
  - A composite foreign key `(recipe_id, household_id)` means a plan can only point at the household's own recipes. Deleting a recipe removes it from the plan.
  - `check` constraints allow only the four meals, 1–50 servings, and sane dates.
  - Column grants: the app can't set `household_id` or move a row to another household.
  - A trigger caps a day at 20 entries: a guard against a bug or stuck button, not a real limit.
  - The data model allows more than one recipe in a spot (a side dish later); the screen shows one at a time for now.
- **Instant feedback:** adding and removing update the screen at once (`useOptimistic`) and show a message if the save fails.
- **Regulars:** a recipe planned 3+ times in the last 8 weeks joins the favorites at the top of the recipe box, labeled "Favorites & regulars". Within each group, the most planned come first (`lib/plan.ts` `rankRecipes`, tested). Counts come from the plan itself, so there's nothing extra to keep in sync.

## Alternatives considered

- **A free-form list per day** (add any meal in any order): the first version. Replaced by fixed spots, which show at a glance what's still open.
- **A separate "add meal" page:** an extra trip and lost context; the inline form keeps the day in view.
- **Storing a usage counter on each recipe:** fast to read, but it can drift from the real plan. Counting the plan is exact and cheap at this size.
- **Server-side "today"** (UTC): wrong for a US evening, when UTC is already tomorrow.

## Consequences

- A week is a long scroll (7 days × 4 spots), but each spot is one tap.
- Milestone 8 can sum this table's ingredients (servings scaled) into the grocery list with a cost estimate.
