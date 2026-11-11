# 0047. A minimal shopping cart for the app icon

**Status:** Accepted · 2026-11-10 · Replaces 0045 (the paper bag)

## Context

The paper grocery bag (0045) worked, but the owner wanted a shopping cart, minimal and clean, in the same two-color, logo-like style.

## Decision

- **A shopping cart drawn as one continuous line** (`assets/app-icon.svg`): the handle, the basket and its base in a single stroke with rounded ends and joins, and two dots for wheels.
- **Two colors only:** clay orange (`#d97757`) on white, matching the wordmark's calm, minimal look.
- **Optically centered** with generous white space, so it sits well among other icons.
- **How it was chosen:** the owner compared original drawings in rounds: line, solid, die-cut, rounded, check-mark, leaf, tile and badge carts. They picked the single-line cart for being the most minimal.
- **The usual icon steps:** `npm run icons` regenerated the PNGs, and `ICON_VERSION` went to 4 so phones fetch the new files. `lib/appIcon.test.ts` checks the sizes and the manifest.

## Alternatives considered

- **Keeping the paper bag:** distinctive, but the owner preferred a cart.
- **A heavier line or a solid basket:** bolder at small size, but less minimal.
- **A cart carrying a check mark:** ties the icon to the grocery list, but adds a second idea.

## Consequences

- The thin line is light on the home screen. If it ever feels faint, the stroke can be thickened in the SVG without changing the design.
- iPhones keep home-screen icons they've already saved: delete the icon and add it again from Safari to see the cart.
