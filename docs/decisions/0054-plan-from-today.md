# 0054. Plan shows today and the next six days

**Status:** Accepted · 2026-11-21 · Changes the week layout from 0017; adjusts "Repeat last week" from 0053

## Context

Plan showed Monday to Sunday. Late in the week, today was near the bottom: on a Saturday you scrolled past five days that were already over to reach today's meals, which is what you open Plan for most.

## Decision

- **Seven days starting today**, today at the top. The address is `/plan?start=<date>`, and the tab link fills in today from the phone's own clock (the server can't know the time zone).
- **‹ ›** jump 7 days back or ahead. A **Today** button appears when you're looking at other days.
- **"This week's groceries"**, the budget, and **Add to grocery list** cover the same seven days. `week_shopping` and `add_week_to_list` already took any start date.
- **Repeat last week** copies the seven days before into the seven shown, day for day (last Saturday → this Saturday). `copy_plan_week` no longer requires Mondays, only that the two ranges be whole weeks apart, so every meal lands on the same weekday (migration `20261124000000_plan_from_today.sql`).
- Old `?week=` links simply open today.

## Alternatives considered

- **Keep Monday to Sunday and scroll to today.** Less change, but days that are over still take the top of the screen, and the jump is jarring.
- **Arrows that move one day.** Finer, but planning next week would take seven taps.
- **Drop Repeat last week.** It's the quickest way to fill a week, so it stays.

## Consequences

- Meals from earlier this week are one tap away (‹), not on screen.
- The budget now compares the next seven days, not the calendar week. For a weekly shop, that's the window that matters.
