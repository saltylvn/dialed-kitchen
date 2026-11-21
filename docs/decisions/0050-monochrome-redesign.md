# 0050. A monochrome redesign: near-black on white, Inter, one accent

**Status:** Accepted · 2026-11-20 · Replaces the fonts in 0008 and the color palette in CLAUDE.md; changes the Grocery tab layout from 0035

## Context

The app looked like a restaurant menu: cream paper, a light italic serif for titles, clay-orange buttons everywhere. The owner wanted it cleaner, calmer and more current, in the style of stackai.com (the look, not its brand): white space, near-black type, hairline borders, very little color.

A three-person review (product design, nutrition tracking, shopping workflow) also found that the Grocery tab opened on an 80px Price book button, so in the store the list, the thing you actually need, sat below the fold. And styles were copied between files: the same button and heading class lists were repeated in a dozen components.

This is Phase 1 of a six-phase plan (look and shared pieces, then calorie counting, shopping, planning, recipes).

## Decision

- **Colors:** white page and cards (`--bg`, `--surface` #ffffff), cards set apart by a 1px hairline (`--border` #e6e6e6) instead of a shade, near-black text (`--text` #1d1d1d), grey secondary text (`--muted` #666666). Buttons, the active tab and selected chips are near-black with white text (`--primary`, `--on-primary`).
- **One accent, used sparingly:** clay orange (`--accent` #d97757) now marks only the cheapest price and the app icon, and always with a ✓ or "BEST", never color alone. Keeping the existing orange keeps the home-screen icon unchanged.
- **Fonts:** Inter for everything readable (one variable font file covers every weight; titles at 500 with slightly tight letter-spacing), DM Mono for small uppercase labels only ("PRODUCE", "BEST", "BREAKFAST"). Poppins and Cormorant Garamond are gone.
- **Shape:** cards 12px corners, buttons and inputs 8px, chips fully round. No shadows.
- **Shared building blocks** in `app/globals.css` (`@layer components`): `btn btn-primary`, `btn btn-secondary`, `card`, `field`, `heading-1`, `heading-2`, `label`, `chip` / `chip-on`. New screens use these instead of repeating class lists, so the look changes in one place.
- **Grocery tab, list first:** one compact row of three equal buttons (Price book, Log price, Scan receipt) under the title, then the Grocery list with its add box at the top, then In stock.
- **Focus:** a visible 2px near-black focus ring on everything keyboard-focusable.

## Alternatives considered

- **Keep clay orange for buttons.** Least change, but the screen stays busy, and the best-price signal is drowned out by every other orange thing.
- **A new accent (green).** Fresher, but it would also need a new app icon; it can still be swapped later by changing one token.
- **Aspekta for headings (closest to stackai.com).** A third font file to download on cellular, for a small difference in big titles.
- **Real React components for every piece** (`<Button>`, `<Card>`). Better for pieces with behavior (the bottom sheet in Phase 2 will be one), but for pure styling a CSS class is lighter and works in server and client components alike.

## Consequences

- Every screen changed look in one PR, with no change to what the app does; the contrast test now also covers white-on-near-black buttons and text on the quiet grey fill.
- The wordmark keeps its shape (spaced capitals over "KITCHEN") but is now Inter with a DM Mono "KITCHEN".
- Older screens still carry some long class lists; they move onto the shared classes as each phase touches them.
