@AGENTS.md

# Dialed Kitchen

An iPhone-first web app (installable PWA) for daily cooking, grocery shopping and meal prep: grocery lists, price tracking with the best price per item across stores, recipes (from websites, cookbooks, magazines, printed pages) and weekly meal planning that builds the grocery list. The owner is a beginner learning web development with Claude Code, so **explain what each change does and why**, and build in small steps.

## Portfolio standards

This repo showcases the owner's software engineering skills for future jobs, so keep the professional practices visible:

- **Branch + pull request for every change** (never commit straight to `main`), with a PR description: what changed, why, how it was tested. CI must pass before merging.
- **CI** (`.github/workflows/ci.yml`) runs a production-dependency security audit, format check, lint, type check, tests and a production build on every push and PR. Keep it green.
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
- **Look: calm, upscale, minimal** (like a good restaurant menu): generous space, type-led, one accent color used sparingly. No clip-art icons for branding.
- **Tabs (three, bottom bar):** Plan · Recipes · Grocery (the grocery list and prices together), defined once in `lib/tabs.ts` (`TABS`, `HOME_TAB`). Opening the app lands on Plan (`/` redirects; the home-screen `start_url` is `/plan`). Tab pages live in `app/(tabs)/`, share the `TabBar` and a `loading.tsx` skeleton, and use `components/ui/TabPage` (title in the display font, ⚙︎ top-right linking to `/settings?from=<tab>`; Settings' back link returns to that tab, unknown values fall back to Plan). The active tab shows an accent bar, darker text and `aria-current`, never color alone.
- **Logo:** `components/ui/Wordmark` (sizes `lg`, `sm`), type only: "DIALED" in light, widely spaced Poppins capitals over a smaller, wider-spaced "KITCHEN". Use it on the sign-in screen and in headers; never retype the name by hand.
- **Fonts (two only):** Poppins for everything readable (body, prices, buttons; the default `font-sans`), and Cormorant Garamond light italic (`font-display`) for large display headlines only (28px+), never for small or essential text. See docs/decisions/0008.
- Body text 17px or more; tap targets 48px or more (one hand, holding a basket). Color is never the only signal: pair it with text or an icon (🎉, ✓, strikethrough).
- No Anthropic logo or name in the app; only the colors.

## Planned features and data model

- **Partner sharing (married couples only; the only kind of sharing):** all data belongs to a `household`, not a user. Every new user gets a household of one. A spouse joins **only by invitation**:
  - The invite is tied to the spouse's email and only works when they sign in with that email.
  - Invite links are single-use, expire after 7 days, and are stored only as a hash.
  - One open invite at a time.
  - **At most two members per household, and each person belongs to exactly one household.** Both rules are enforced by database constraints, not just app code.
  - No other sharing (no families, friends, guests or roles). The UI calls it **Partner**.
  - Either partner can leave: the shared data stays with the household's creator, and the one who leaves starts fresh. A joining partner's old solo data stays private, never merged.
  - Every data table has `household_id`, with RLS allowing only that household's members.
- **Groceries:** `stores`, `items` (one row per thing you buy: name, category, default unit, one comparison unit: per lb, per fl oz, or each).
- **Prices:** `item_prices` (item, store, price, package quantity + unit, date, sale flag). Every price is kept as history. **Best price** = the lowest unit price ever entered for the item, computed from the history (not stored), shown with store and date; sale prices are labeled; prices older than 90 days are marked "older". Entering a price shows "🎉 New best price!" or "X% more than your best". Unit-price math in `lib/pricing.ts` with tests; an index keeps the best-price lookup fast.
- **Grocery lists:** `grocery_lists`, `grocery_list_items` (item, amount, checked, source: manual or meal plan). Shopping mode with big checkboxes, best price and "last here" price per item.
- **Recipes:** `recipes` (title, servings, steps, source), `recipe_ingredients` (linked to `items`, amount, unit). Import from a URL by reading the page's schema.org Recipe data (no AI); Gemini only as a fallback. Import from a photo of a cookbook/magazine page via Gemini, always shown as an editable form before saving.
- **Meal plan:** `meal_plan_entries` (date, meal, recipe, servings) → generate a grocery list (ingredients summed across recipes) with an estimated cost from best/latest prices.
- **Units:** conversions in `lib/units.ts` with tests; anything that can't be converted is listed separately, never guessed.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, Supabase (Postgres, Google sign-in, private storage), Google Gemini free tier (server-side only), Vercel Hobby. All free tier.

## Security

- Row-level security on every Supabase table; every row belongs to one household and only that household's members can read or change it.
- Validate every form and server-action input (zod) before it touches the database.
- Secret keys only in `.env.local` (git-ignored) and Vercel; never in browser code.
- AI is called only from the server, its JSON reply validated before use, with a daily per-user limit.
- Fetching a recipe URL: https only, block private/local network addresses, time and size limits.
- Recipe photos in a private storage bucket.

## Architecture (see docs/decisions/0005)

Build at a senior-engineer standard: organized, efficient and secure. Folder layout:

```
app/                 routes only: pages, layouts, loading/error states. Thin: no business logic, no SQL.
features/<feature>/  one folder per feature (prices, lists, recipes, meal-plan):
  components/        that feature's UI
  actions.ts         server actions (writes): "use server"
  queries.ts         data access layer (reads): import "server-only"
  schema.ts          zod schemas: the shape of valid input
components/ui/       shared, generic UI pieces (Button, Card, Sheet)
lib/                 pure logic with no I/O (pricing, units, contrast), unit tested; relative imports
lib/server/          server-only infrastructure: Supabase clients, env validation
supabase/migrations/ versioned SQL: tables, indexes, RLS policies
docs/decisions/      decision records
```

Every request flows through the same layers; each one checks something:

1. **UI** (`components`, server components by default; `"use client"` only for interactivity) never talks to the database directly.
2. **Server action / page** parses input with the feature's zod schema (reject, don't fix up) and confirms the signed-in user.
3. **Data access layer** (`queries.ts`, `actions.ts`) is server-only, uses the request's Supabase client (the user's session, so RLS applies; never the service key for user data) and returns only the fields the UI needs.
4. **Postgres RLS** is the final guard: every table has `user_id` and policies so a user can only touch their own rows, even if app code has a bug.

Rules:

- Validate at every trust boundary: form input, URL params, AI replies, fetched web pages. Types are not validation.
- Server actions return a typed result (`{ ok: true, data } | { ok: false, error }`) with a user-friendly message; log details on the server, never send stack traces or database errors to the browser.
- Secrets are read only in `lib/server/env.ts` (validated at startup with zod); browser code only sees `NEXT_PUBLIC_*` values that are safe to be public.
- Database: migrations are append-only (never edit one that has been applied); foreign keys with explicit `on delete`; `check` constraints for invariants (price > 0, quantity > 0); money as `numeric(10,2)`, never floating point in the database.
- Accessibility: semantic HTML (real `<button>`, `<label>` for every input), visible focus, 48px+ targets.
- TypeScript is strict (incl. `noUncheckedIndexedAccess`); no `any`; avoid `as` casts except at a validated boundary.

## Performance (speed is a feature: the app is used in the store, often on cellular)

Targets: every tap responds instantly (under 100 ms visual feedback); pages usable in under 1.5 s on a phone over 4G; Lighthouse mobile performance 95+.

- **Ship little JavaScript:** server components by default; `"use client"` only on the small interactive leaf (a checkbox, a sheet), never on a whole page. No heavy libraries for small jobs (dates, formatting: use `Intl`).
- **Instant feedback:** every route has a `loading.tsx` skeleton; checking off list items and saving prices update the screen immediately (optimistic UI with `useOptimistic`) and roll back with a message if the save fails.
- **Few round trips:** fetch on the server, independent reads in parallel (`Promise.all`), one query per screen where possible (joins or a database view over many small queries), never queries in a loop (N+1).
- **Lean queries:** select only the columns the screen needs; index every foreign key and every column used to filter or sort; paginate long lists (price history).
- **Cache what's safe:** static assets and fonts are cached by Vercel's CDN; user data is per-request (never cached across users).
- **Images:** `next/image` with explicit sizes; recipe photos resized in the browser before upload.
- Measure, don't guess: check Lighthouse on the deployed site after each milestone, and the build output's route sizes in PRs.

## Conventions

- Dates are stored as the user's local calendar date, not UTC timestamps.
- Check the bundled docs in `node_modules/next/dist/docs/` before using a Next.js API (see `AGENTS.md`).
- Add dependencies only with the first code that uses them; prefer the platform and existing deps over new packages.
- Small, focused commits with clear messages; one concern per pull request.

## Commands

- `npm run dev`: start the local dev server
- `npm run build`: production build
- `npm test`: run unit tests (vitest)
- `npm run lint`: lint
- `npm run typecheck`: TypeScript check
- `npm run format` / `npm run format:check`: Prettier
- CI runs: audit, format check, lint, typecheck, tests, build. Run the same locally before pushing.
- **Database changes:** add a new file in `supabase/migrations/` (`YYYYMMDDHHMMSS_name.sql`; never edit one already applied), cover it in `supabase/tests/` (real Postgres via PGlite: `createTestDb()`, `db.as(user, sql)` runs with RLS as that user), then the owner applies it with `npx supabase db push`. **Always run Supabase CLI commands from this project folder** (`cd ~/Developer/dialed-kitchen` first): run elsewhere, the CLI links that folder instead and pushes nothing. The project is linked to `zitsdiffnbzyhleorcmg`; `npx supabase migration list` shows what's applied.

## Roadmap

0. Project setup ✅ (Next.js, colors and fonts, contrast test, GitHub repo, README, CI, decision records; live at https://dialed-kitchen.vercel.app, deployed by Vercel on every push to `main`)
1. Google sign-in, the wordmark, and the tab layout (Plan · Recipes · Grocery) ✅
   1b. Partner sharing: households, invite-only partnership for a married couple ✅
2. Stores, items and price entry with unit prices, best price, "New best!" and history
3. Grocery lists with shopping mode
4. Recipes entered by hand
5. Recipe import from a website link
6. Recipe import from a photo
7. Weekly meal planner
8. Meal plan → grocery list with estimated cost
9. Polish: price trends, cheapest store, meal-prep batch view, app icon
