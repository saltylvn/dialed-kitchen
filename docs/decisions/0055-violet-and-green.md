# 0055. Violet for actions, green for best price, pill buttons

**Status:** Accepted · 2026-11-21 · Changes the colors and button shape of 0050; the brand guide is `docs/brand.md`

## Context

The monochrome redesign (0050) made buttons near-black and used clay orange only for the best-price signal. The owner wanted the app's accents to feel like monday.com's: a bright violet as the main color, cheerful colors for status, and pill-shaped buttons.

## Decision

- **Violet `#5c5cff` for actions**: buttons, the active tab bar, selected chips, the Today badge, the focus ring. It's monday.com's `#6161ff`, a hair darker, because white text on `#6161ff` reaches only 4.46:1 and the sunlight rule needs 4.5:1.
- **Green `#00a960` for best price** (the cheapest store's ✓ outline) and good news, with `#007a45` for green text. It's monday's "done" green, darkened so the outline reaches 3:1 on white. Green reads as "good deal", and it stands apart from the violet buttons.
- **Pill buttons**: `btn` and every 48px button are fully rounded. Cards keep 12px corners, and inputs keep 8px.
- Text stays near-black on white. Violet and green each have one job and are never decoration.
- `lib/contrast.test.ts` now also checks that outlines and bars reach 3:1 (WCAG non-text contrast), not only that text reaches 4.5:1.
- The app icon moves to the new colors once the owner picks a design from the options shown.

## Alternatives considered

- **Keep near-black buttons with violet highlights.** Quieter, but further from the look the owner asked for.
- **monday's pink-red for best price.** Eye-catching, but red reads as a warning, not a deal.
- **monday's exact `#6161ff`.** It fails 4.5:1 for white text by a hair, and the sunlight rule wins.

## Consequences

- The app has two brand colors instead of one, so the guide limits each to one meaning.
- The clay orange is gone from the app. The `--accent` token keeps its name, now green, so no component changed.
