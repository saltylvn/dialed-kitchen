# 0045. A paper grocery bag for the app icon

**Status:** Replaced by 0047 · 2026-11-10 · Replaces 0042 (the orange slice)

## Context

The orange slice said "fresh food", but Dialed Kitchen is mostly about shopping: the grocery list, prices and the price book. The owner wanted the icon to say "groceries", and to look like a logo in the same spirit as the wordmark: flat, simple and calm.

## Decision

- **A paper grocery bag** (`assets/app-icon.svg`), drawn as a flat mark:
  - **Two colors only:** clay orange (`#d97757`) on a white background. The fold line is "drawn" in the background color, so no third color appears.
  - A flat paper **strap handle** (the kind on supermarket paper bags), a **serrated top edge** like a real paper bag, and one **fold line** near the top.
  - Taller than wide, and centered with plenty of white around it, so it reads clearly at home-screen size.
- **How it was chosen:** the owner compared original drawings: line and solid shopping carts, totes, bags with produce, 3D paper bags in clay and kraft, then flat two-color versions. They picked the flat bag with the serrated top.
- **Original artwork:** the strap-handle paper bag is a common supermarket design. No store's logo, artwork or colors were copied. A curved mark on one draft was dropped because it looked like a well-known retailer's logo.
- **The usual icon steps:** `npm run icons` regenerated the PNGs, and `ICON_VERSION` went to 3 so phones fetch the new files. `lib/appIcon.test.ts` checks the sizes and the manifest.

## Alternatives considered

- **A shopping cart:** clear, but generic, and busier at small size.
- **A bag with greens or fruit, or in kraft brown:** more literal, but more colors and less logo-like.
- **A fine-line outline** matching the wordmark's light weight: elegant, but faint on the home screen.

## Consequences

- The icon now matches what the app is for, and it uses only the brand's accent color.
- iPhones keep home-screen icons they've already saved: delete the icon and add it again from Safari to see the bag.
