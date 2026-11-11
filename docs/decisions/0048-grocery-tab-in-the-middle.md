# 0048. Tab order: Plan · Grocery · Recipes, opening on Grocery

**Status:** Accepted · 2026-11-10 · Replaces 0036 (Recipes · Plan · Grocery)

## Context

The bottom bar was Recipes · Plan · Grocery, with Plan in the middle. The owner uses the Grocery tab most, often one-handed in the store, and wants it in the middle, the easiest spot for a thumb to reach, and to be where the app opens.

## Decision

- **Plan · Grocery · Recipes:** Plan on the left, Grocery in the middle, Recipes on the right.
- **The app opens on Grocery.** `HOME_TAB` (chosen by id, not position) is now Grocery: `/` redirects there, sign-in and "Try the demo" land there, Settings falls back to it, and the home-screen `start_url` is `/grocery` (a test checks they match).
- **A partner who just joined still lands on Plan**, where the welcome message is.
- The order lives in one place, `TABS` in `lib/tabs.ts`, and `lib/tabs.test.ts` checks it.

## Alternatives considered

- **Keep opening on Plan:** Plan is the start of the week, but the owner opens the app most often to shop.

## Consequences

- The most-used tab is under the thumb and opens first. Phones that saved the app to the home screen pick up the new start page after deleting and re-adding the icon. People used to the old order will find Recipes and Plan swapped sides.
