# 0042. An orange slice for the app icon

**Status:** Accepted · 2026-11-09 · Replaces the fork icon

## Context

The home-screen icon was a slim clay-orange dinner fork on cream. The owner wanted a fruit in the same colors and first asked for an apple "like the Apple logo".

## Decision

- **An orange slice** (`assets/app-icon.svg`), drawn as a mark rather than an illustration:
  - A clay-orange rind (`#d97757`) and an even cream pith ring (`#faf9f5`).
  - **Eight rounded segments** in a lighter tint of the same orange (`#e9a185`). Each stops short of the rind and tapers toward the centre, so it reads as fruit, not a pie chart. Corners are rounded with a same-colour stroke.
  - The slice is **turned slightly** for movement and sits a little below centre to balance the **green leaf** (`#788c5d`). The leaf has a fine cream vein and a thin cream edge where it overlaps the rind.
  - Checked at actual home-screen size, where it still reads clearly.
- **How it was chosen:** the owner compared original drawings: several apples (solid, line art, cut in half), five orange slices, then four refined versions of the slice they preferred (two-tone, monochrome, bold six-segment, tilted), and picked the tilted one.
- **Not Apple's logo, or a copy of it.** The owner first asked for Apple's outline without the bite. That outline and its floating leaf are Apple's trademark, and Apple enforces even loose resemblances (it challenged a meal-planning app's pear logo in 2020). So the icons drawn were original, and the final choice is a different fruit altogether.
- **The usual icon steps:** `npm run icons` regenerates the PNGs, `ICON_VERSION` goes to 2 so phones fetch the new files, and `lib/appIcon.test.ts` checks the sizes and manifest. (SVG comments can't contain a double hyphen, or the renderer refuses the file.)

## Alternatives considered

- **An apple:** the cut apple was a close second, but the orange slice reads clearly at icon size and is unmistakably this app's.
- **Keeping the fork:** distinctive, but the owner preferred fruit.

## Consequences

- iPhones keep home-screen icons they've already saved: delete the icon and add it again from Safari to see the orange slice.
