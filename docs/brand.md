# Dialed Kitchen brand and style guide

The rules every screen follows. The tokens live in `app/globals.css`, and `lib/contrast.test.ts` checks them. Decisions behind them: [0050](decisions/0050-monochrome-redesign.md) (monochrome base), [0055](decisions/0055-violet-and-green.md) (violet and green).

## Personality

- **Calm, quick, practical.** It's used in a store aisle, one-handed, often in sunlight, often on cellular.
- **Clean, modern, light**: white space, near-black type, hairline borders, one action color.
- **Plain words.** "In stock", never "have it". "Cheapest", "Best price", "Leftovers". Sentence case everywhere except small labels.
- No brand names, logos or clip art from other companies.

## Color

Light mode only, even when the phone is set to dark. Components use the token names (`bg-primary`, `text-muted`…), never hex codes.

| Token                          | Hex                   | Use                                                                                                     |
| ------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `--bg` / `--surface`           | `#ffffff`             | Page and cards. Cards are set apart by a hairline, not a shade.                                         |
| `--surface-2`                  | `#f5f5f5`             | Quiet fills: skeletons, pressed rows.                                                                   |
| `--border`                     | `#e6e6e6`             | Hairlines: card edges, dividers.                                                                        |
| `--border-strong`              | `#d4d4d4`             | Inputs and checkboxes.                                                                                  |
| `--text`                       | `#1d1d1d`             | Main text.                                                                                              |
| `--muted`                      | `#666666`             | Dates, secondary info, labels.                                                                          |
| `--primary`                    | `#5c5cff`             | **Violet. Actions only**: buttons, the active tab bar, selected chips, the Today badge, the focus ring. |
| `--on-primary`                 | `#ffffff`             | Text on violet.                                                                                         |
| `--accent`                     | `#00a960`             | **Green. Best price only**: the cheapest store's outline. Always with ✓ or "BEST".                      |
| `--on-accent`                  | `#1d1d1d`             | Text on green: near-black, never white.                                                                 |
| `--success` / `--success-text` | `#00a960` / `#007a45` | Good-news fills and text: "🎉 New best price!", "✓ within budget".                                      |
| `--info` / `--info-text`       | `#6a9bcc` / `#3b6896` | Blue fills and links.                                                                                   |

Rules:

- **One job per color.** Violet means "you can tap this". Green means "good deal / done". Don't use either for decoration.
- **Never color alone.** Pair every color signal with text or a symbol: ✓, "BEST", "Today", strikethrough.
- **Sunlight contrast:** text reaches 4.5:1 on its background. Outlines and bars that carry meaning reach 3:1. That's why violet is `#5c5cff`, not monday.com's `#6161ff`: white text on `#6161ff` is 4.46:1. Add every new pair to `lib/contrast.test.ts`.

## Type

- **Inter** for everything readable. Body text is 17px or larger, at weight 400. Titles are weight 500 with slightly tight spacing (`heading-1` 34px, `heading-2` 22px).
- **DM Mono** only for small uppercase labels (`label`: "PRODUCE", "BREAKFAST", "BEST"), never for sentences.
- Avoid bold (700). Weight 500 is the strongest.

## Shape and spacing

- **Buttons are pills** (`btn btn-primary`, `btn btn-secondary`), 48px tall.
- **Chips are pills** (`chip`, `chip-on` when selected).
- **Cards** have 12px corners and a hairline (`card`). **Inputs** have 8px corners (`field`), 17px text so iOS doesn't zoom.
- No shadows. No gradients.
- Tap targets are at least 48px: the app is used one-handed, holding a basket.

## Building blocks

Use these, don't repeat class lists: `btn` + `btn-primary` / `btn-secondary`, `card`, `field`, `heading-1`, `heading-2`, `label`, `chip` / `chip-on` (all in `app/globals.css`). For page layouts use `components/ui/TabPage` and `SubPage`; for the logo, `components/ui/Wordmark`; for food names, `components/ui/FoodEmoji`.

## Logo and icon

- **Wordmark:** "DIALED" in widely spaced Inter capitals, weight 500, over a smaller, wider-spaced DM Mono "KITCHEN". It's type only and near-black. Use `Wordmark`, never retype it.
- **App icon:** one simple line drawing in a brand color on white, two colors at most, no text, readable at 29px. Source: `assets/app-icon.svg`. After changing it, run `npm run icons`, bump `ICON_VERSION` in `lib/iconVersion.ts`, and commit the PNGs.

## Motion and feedback

- Every tap responds at once: optimistic updates with an undo or a message if saving fails.
- Motion is rare and small (opacity on press), and respects reduced motion.
- Messages are short and say what happened: "✓ Copied 3 meals from last week."

## Accessibility checklist for a new screen

- [ ] Real `<button>` and `<label>` elements, and a visible focus ring
- [ ] Tap targets 48px or larger, body text 17px or larger
- [ ] Every color signal also has text or a symbol
- [ ] New text/background pairs added to `lib/contrast.test.ts`
- [ ] No inline `style` attributes (the CSP blocks them)
