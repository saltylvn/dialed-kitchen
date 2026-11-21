# 0051. Calorie counting: a private food log, logged from the plan

**Status:** Accepted · 2026-11-21 · Builds on 0017 (meal plan) and 0018 (calories and macros)

## Context

Recipes already carry calories and macros per serving, and the Plan tab totals what is _planned_ each day (0018). But nothing records what each person actually _ate_, there is no goal, and the two partners eat different portions of the same dinner. The owner wants real calorie counting that rides on the meal plan instead of becoming a chore.

## Decision

- **The plan is what the household means to eat; the log is what one person ate.** A new table, `food_log`, holds one row per thing a person ate: the day, the meal, where it came from (a planned meal, or typed in) and the servings.
- **Logged from the plan in one tap.** A **Today** card at the top of the Plan tab lists today's planned meals with **✓ Ate it**, which logs the person's usual portion (their last portion of that recipe, else 1). The portion can then be changed on a wheel. **Ate the plan** logs every meal of the day at once. **Quick add** covers anything else (a name and calories, protein optional).
- **Numbers are a snapshot.** Calories and macros are copied from the recipe, scaled by the portion, when the meal is logged. Editing the recipe later never rewrites the past. A recipe with no numbers logs as _unknown_, and the card names it ("Not counted: Tacos") instead of counting it as zero.
- **Private to each person.** Unlike everything else in the app, the log and the goal are body data, so row-level security shows each person only their own (`user_id = auth.uid()`), even inside a shared household.
- **Writes only through database functions** (`log_planned_meal`, `log_day_as_planned`, `log_quick`, `set_my_goal`). They work out the household and the numbers themselves and check that the planned meal belongs to the caller's household. The app can read and delete its own rows, but never insert or edit them directly.
- **A goal per person:** daily calories (500–10,000) and optional protein, set in Settings on swipe wheels.
- **Idempotent taps:** a planned meal is logged at most once per person (a unique key on person + planned meal), so tapping twice, or a retry, just updates the portion. A cap of 60 entries a day stops a stuck button.
- **The demo** clears its food log and goal in the daily reset.

## Alternatives considered

- **Compute "eaten" from the plan with a checkbox per meal** (no snapshot). Simpler, but editing a recipe would silently rewrite history, and partners' different portions couldn't be recorded.
- **A shared household log.** Easier to build, but it puts one partner's eating and goals in front of the other. Logging _for_ a partner ("we both ate it") is left for later, through a checked function.
- **A goal history** (`effective_from`), so past days are judged against the goal of the time. Worth it once there are trends to look back on; until then, one current goal.
- **A food database (USDA FoodData Central).** Free, and planned for later; quick add covers non-recipe foods for now.

## Consequences

- Logging a planned meal takes one tap, or two with a portion change. The whole day takes one.
- The numbers are only as good as the recipes'. AI-estimated numbers aren't labeled yet; marking them ("~") needs a `nutrition_source` on recipes, a follow-up.
- Today needs the phone's date, so the card renders in the browser (`useToday`), and only when today is in the week on screen.
- Two new tables and five functions, all covered by database tests (privacy, snapshots, once-only logging, usual portion, the demo reset).
