# 0002. Light mode only, with contrast checked by a test

**Status:** Accepted · 2026-10-22

## Context
The app is used mostly during the day: in the kitchen and in grocery stores, sometimes in direct sunlight. Glare washes out low-contrast colors. The chosen palette is Anthropic's (cream, near-black, clay orange, olive green, blue), and some of its colors are too light to read as text.

## Decision
- Always render in light mode, even when the phone is set to dark (`color-scheme: light`).
- Define every color once as a named token in `app/globals.css`; components never use raw hex codes.
- Require every text color to reach WCAG AA contrast (4.5:1) on its background, enforced by `lib/contrast.test.ts`, which reads the CSS file directly.

Measured results that shaped the palette:

| Pair | Ratio | Result |
|---|---|---|
| White text on the orange accent | 3.1 | Fails → buttons use near-black text (5.9) |
| Brand green as text on cream | 3.5 | Fails → darker `--success-text` (5.9) |
| Brand blue as text on cream | 2.8 | Fails → darker `--info-text` (5.5) |

## Alternatives considered
- **Follow the phone's light/dark setting:** twice the design and testing work for a mode that's rarely useful in daylight.
- **Check contrast by hand once:** works until someone tweaks a color. A test keeps the rule true forever and documents it in code.

## Consequences
- One theme to design and test.
- Tokens keep the door open for a dark mode later: it would be one extra block of values.
- Adding a new text color means adding its pairs to the contrast test.
