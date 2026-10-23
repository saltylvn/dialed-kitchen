# Dialed Kitchen

**Plan it, price it, cook it.** An iPhone-first web app for daily cooking, grocery shopping and meal prep: grocery lists, price tracking that remembers the best price for every item across stores, recipes imported from websites or photographed from cookbooks, and weekly meal plans that build the grocery list and estimate its cost.

> **Live:** [dialed-kitchen.vercel.app](https://dialed-kitchen.vercel.app) · Status: early development. See the [roadmap](#roadmap).

## Why it exists

Grocery prices vary a lot between stores and over time, and it's hard to remember whether a price is a good one while standing in the aisle. Dialed Kitchen keeps a price history for every item, compares prices by **unit price** (so a 5 lb bag and a 2 lb bag compare fairly), and shows your best price found so far, right on the shopping list.

## Features (planned)

- **Best price per item:** every price is kept as history; the lowest unit price is shown with store and date. Entering a price shows "🎉 New best price!" or "12% more than your best".
- **Grocery lists** with a one-handed shopping mode.
- **Recipes** from a website link (parsed from the page's schema.org data, no AI needed), from a photo of a cookbook or magazine page (AI-assisted, always reviewed before saving), or typed by hand.
- **Meal planning** for the week ahead → one combined grocery list with an estimated cost.

## Architecture

| Layer             | Choice                                                                  | Why                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| UI and server     | Next.js 16 (App Router), React Server Components, TypeScript            | One codebase for UI and server logic; server components keep data access and secrets off the phone                               |
| Styling           | Tailwind CSS v4 with named color tokens                                 | One source of truth for colors; contrast verified by a test                                                                      |
| Database and auth | Supabase (Postgres, Google sign-in, private storage)                    | Real relational data with row-level security                                                                                     |
| AI                | Google Gemini (server-side only)                                        | Reading recipes from photos; free tier                                                                                           |
| Hosting           | Vercel                                                                  | Deploys every push to `main`                                                                                                     |
| Quality and CI    | Vitest, ESLint, Prettier, strict TypeScript, GitHub Actions, Dependabot | Security audit, format, lint, type check, tests and a production build on every push and pull request; weekly dependency updates |

Key design decisions and the alternatives considered are recorded in [`docs/decisions/`](docs/decisions/).

### Data model (planned)

```
stores ─┐
        ├─< item_prices >── items ──< recipe_ingredients >── recipes ──< meal_plan_entries
        │                     │
        │                     └──< grocery_list_items >── grocery_lists
```

- `item_prices` stores price, package quantity and unit, date and a sale flag; **unit price and best price are computed**, never stored, so they can't go stale.
- Pure business logic (unit price, best price, unit conversion, building a list from a meal plan) lives in `lib/` with unit tests.

### Security

- Row-level security on every table: each row belongs to one user, enforced by the database itself, not only by app code.
- All form and server-action input is validated before it reaches the database.
- Secrets live only in environment variables on the server; none are sent to the browser.
- Recipe-URL import is protected against server-side request forgery: https only, private network addresses blocked, time and size limits.
- AI responses are validated against a schema before use; AI calls have a daily per-user limit.

### Design

Light mode only, built to be readable in daylight in a grocery store: Anthropic-inspired warm palette, 17px+ body text, 48px+ tap targets. Every text color is checked by an automated test to meet the WCAG AA contrast ratio (4.5:1).

## Running locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev     # http://localhost:3100 via .claude/launch.json, or http://localhost:3000 by default
npm test        # unit tests
npm run lint
npm run build   # production build
```

## Roadmap

- [x] 0. Project setup, design tokens, CI, first deploy
- [x] 1. Google sign-in and app layout (Plan · Recipes · Grocery tabs)
- [x] 1b. Partner sharing: invite-only, for a married couple
- [x] 2. Stores, items, prices: unit price, best price, history
- [x] 3. Grocery list and shopping mode
- [ ] 4. Recipes entered by hand
- [ ] 5. Recipe import from a website
- [ ] 6. Recipe import from a photo
- [ ] 7. Weekly meal planner
- [ ] 8. Meal plan → grocery list with estimated cost
- [ ] 9. Price trends, cheapest store, meal-prep view (app icon done)
