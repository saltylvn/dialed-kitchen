# 0041. Remove the separate meal-prep page

**Status:** Accepted · 2026-11-09 · Retires the app side of decision 0022

## Context

Decision 0022 added a Meal prep page (`/plan/prep`), reached from a "Meal prep ›" link on the Plan tab's "This week's groceries" card. It listed recipes to batch-cook and ingredients to prep once. The owner finds it redundant: meal prep is done from the Plan tab itself.

## Decision

- **The page, its link and its helpers are removed:** the "Meal prep ›" link, the page's content, `lib/mealPrep.ts` and its tests, and the `uses` field the app read from `week_shopping`.
- **`/plan/prep` redirects to `/plan`**, so old links and bookmarks still work.
- **The database is unchanged.** `week_shopping` still returns its `uses` column, and the week's grocery list simply doesn't read it. Changing the function would mean a migration for no visible gain.

## Alternatives considered

- **Moving the batch-cook list onto the Plan tab:** keeps the information, but makes Plan longer for something the owner doesn't use.

## Consequences

- The Plan tab is the one place for the week: meals, calories and macros, and this week's groceries.
- If a prep view is wanted again, `week_shopping.uses` still has the data.
