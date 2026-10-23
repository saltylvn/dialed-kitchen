# 0008. A type-only wordmark and two fonts

**Status:** Accepted · 2026-10-22

## Context

The app needs a logo and a typographic voice that feel calm and upscale, like a good restaurant menu, while staying readable on a phone in a bright grocery store. Early drafts paired the name with a fork icon; it read as clip art rather than elegant. The first font setup used three families (Poppins, Lora, and system fallbacks for display).

## Decision

- **Wordmark is pure type** (`components/ui/Wordmark.tsx`): "DIALED" in light, widely spaced Poppins capitals, with a smaller, wider-spaced "KITCHEN" beneath in the muted color. The only ornament is a short clay-orange rule used on the sign-in screen. Screen readers hear "Dialed Kitchen" (visually hidden text); the spaced-out letters are hidden from them.
- **Two font families:**
  - **Poppins** (300–600) for the wordmark, body text, prices and buttons: a sturdy sans-serif that stays legible in sunlight.
  - **Cormorant Garamond** light italic, for large display headlines only (28px and up). Utility: `font-display`.
- Both are free Google Fonts, self-hosted by `next/font`: no requests to Google, and no layout shift while fonts load.

## Alternatives considered

- **A fork or cutlery icon with the name:** too literal; it distracted from the type.
- **Serif capitals for the wordmark:** refined, but heavier and more formal than the sans version.
- **Keeping Lora for body text:** a third font file to download, with little benefit over Poppins for short UI text.

## Consequences

- One fewer font family to download, so pages load slightly faster.
- The thin italic display font is never used for small or essential text (prices, list items, buttons), so the sunlight contrast rule still holds.
- The wordmark is text, so it stays sharp at any size and can be restyled with the color tokens.
