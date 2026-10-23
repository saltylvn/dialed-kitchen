@AGENTS.md

# Dialed Kitchen

An iPhone-first web app (installable PWA) for daily cooking, grocery shopping and meal prep: grocery lists, price tracking with the best price per item across stores, recipes (from websites, cookbooks, magazines, printed pages) and weekly meal planning that builds the grocery list. The owner is a beginner learning web development with Claude Code, so **explain what each change does and why**, and build in small steps.

## Portfolio standards
This repo showcases the owner's software engineering skills for future jobs, so keep the professional practices visible:
- **Branch + pull request for every change** (never commit straight to `main`), with a PR description: what changed, why, how it was tested. CI must pass before merging.
- **CI** (`.github/workflows/ci.yml`) runs lint, tests and a production build on every push and PR. Keep it green.
- **Decision records** in `docs/decisions/` (numbered, short: context, decision, alternatives, consequences) for every significant design choice; add a row to `docs/decisions/README.md`. Write them in plain language the owner can explain in an interview.
- **Database changes as versioned migration files** in the repo (Supabase CLI), never only clicked in the dashboard.
- Keep `README.md` current (features, architecture, data model, security, roadmap checkboxes) as milestones land.
- Tests for business logic and security-sensitive code (pricing, units, list building, URL fetching).
- The owner must be able to explain every part, so keep explaining changes as they're made.

## Design (light mode only, built for daylight)
- **Always light mode**, even when the phone is set to dark (`color-scheme: light` in `app/globals.css`, `viewport.colorScheme` in `app/layout.tsx`). No dark-mode styles; colors are still named tokens so one could be added later.
- **Colors: Anthropic's palette** as tokens in `app/globals.css`, used through Tailwind names (`bg-accent`, `text-muted`…), never raw hex codes in components:
  - `--bg` #faf9f5 (cream page), `--surface` #ffffff (cards), `--border` #e8e6dc, `--text` #141413, `--muted` #5e5d58
  - `--accent` #d97757 (clay orange: buttons, active tab) with `--on-accent` #141413. **Text on the orange is always near-black (`text-on-accent`), never white** (white fails contrast).
  - `--success` #788c5d and `--info` #6a9bcc are for fills and icons only; for text use `--success-text` #556640 and `--info-text` #3b6896.
- **Sunlight rule:** every text color must reach 4.5:1 contrast on its background. `lib/contrast.test.ts` reads `globals.css` and checks every text/background pair; add new pairs there when adding a text color.
- Fonts: Poppins for headings (`font-heading`), Lora for body (free Google Fonts close to Anthropic's own).
- Body text 17px or more; tap targets 48px or more (one hand, holding a basket). Color is never the only signal: pair it with text or an icon (🎉, ✓, strikethrough).
- No Anthropic logo or name in the app; only the colors.

## Planned features and data model
- **Groceries:** `stores`, `items` (one row per thing you buy: name, category, default unit, one comparison unit: per lb, per fl oz, or each).
- **Prices:** `item_prices` (item, store, price, package quantity + unit, date, sale flag). Every price is kept as history. **Best price** = the lowest unit price ever entered for the item, computed from the history (not stored), shown with store and date; sale prices are labeled; prices older than 90 days are marked "older". Entering a price shows "🎉 New best price!" or "X% more than your best". Unit-price math in `lib/pricing.ts` with tests; an index keeps the best-price lookup fast.
- **Grocery lists:** `grocery_lists`, `grocery_list_items` (item, amount, checked, source: manual or meal plan). Shopping mode with big checkboxes, best price and "last here" price per item.
- **Recipes:** `recipes` (title, servings, steps, source), `recipe_ingredients` (linked to `items`, amount, unit). Import from a URL by reading the page's schema.org Recipe data (no AI); Gemini only as a fallback. Import from a photo of a cookbook/magazine page via Gemini, always shown as an editable form before saving.
- **Meal plan:** `meal_plan_entries` (date, meal, recipe, servings) → generate a grocery list (ingredients summed across recipes) with an estimated cost from best/latest prices.
- **Units:** conversions in `lib/units.ts` with tests; anything that can't be converted is listed separately, never guessed.

## Stack
Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, Supabase (Postgres, Google sign-in, private storage), Google Gemini free tier (server-side only), Vercel Hobby. All free tier.

## Security
- Row-level security on every Supabase table; every row is scoped to the signed-in user.
- Validate every form and server-action input (zod) before it touches the database.
- Secret keys only in `.env.local` (git-ignored) and Vercel; never in browser code.
- AI is called only from the server, its JSON reply validated before use, with a daily per-user limit.
- Fetching a recipe URL: https only, block private/local network addresses, time and size limits.
- Recipe photos in a private storage bucket.

## Conventions
- Dates are stored as the user's local calendar date, not UTC timestamps.
- Keep pure logic (unit price, best price, unit conversion, list building) in `lib/` with unit tests; lib files use relative imports so vitest can load them.
- Browser-only code goes in components marked `"use client"`; pages in `app/` are server components by default.
- Check the bundled docs in `node_modules/next/dist/docs/` before using a Next.js API (see `AGENTS.md`).
- Small, focused git commits with clear messages.

## Commands
- `npm run dev`: start the local dev server
- `npm run build`: production build
- `npm test`: run unit tests (vitest)
- `npm run lint`: lint

## Roadmap
0. Project setup ✅ (Next.js, colors and fonts, contrast test, GitHub repo, README, CI, decision records; live at https://dialed-kitchen.vercel.app, deployed by Vercel on every push to `main`)
1. Google sign-in (new Supabase project) and the tab layout
2. Stores, items and price entry with unit prices, best price, "New best!" and history
3. Grocery lists with shopping mode
4. Recipes entered by hand
5. Recipe import from a website link
6. Recipe import from a photo
7. Weekly meal planner
8. Meal plan → grocery list with estimated cost
9. Polish: price trends, cheapest store, meal-prep batch view, app icon
