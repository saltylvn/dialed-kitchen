# 0036. Tab order: Recipes · Plan · Grocery

**Status:** Replaced by 0048 · 2026-11-09 · Changes the original order (Plan · Recipes · Grocery)

## Context

The bottom bar was Plan · Recipes · Grocery, and the app opens on Plan. The owner asked for Plan in the middle, with Recipes on the left, and for the app to keep opening on Plan.

## Decision

- **`TABS` in `lib/tabs.ts` is Recipes · Plan · Grocery.** The tab bar draws from it, so the order changes everywhere at once.
- **`HOME_TAB` is Plan, chosen by its id rather than "the first tab"**, so reordering the tabs can never change where the app opens. `/` redirects there, the home-screen `start_url` is `/plan`, and Settings' back link falls back to it.
- Tests check the order, that the home tab is Plan, and that it matches the manifest's `start_url`.

## Alternatives considered

- **Keeping "home = first tab":** simpler, but it would have made Recipes the start page. That's a surprise a test now prevents.

## Consequences

- Plan, the screen opened most, sits in the middle of the bar, easy to reach with a thumb.
- Recipes and Grocery sit on either side.
