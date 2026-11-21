@AGENTS.md

# Dialed Kitchen

An iPhone-first web app (installable PWA) for daily cooking, grocery shopping and meal prep: grocery lists, price tracking with the best price per item across stores, recipes (from websites, cookbooks, magazines, printed pages) and weekly meal planning that builds the grocery list. The owner directs this project with Claude Code and must be able to explain every part of it, so **explain what each change does and why**, and build in small steps.

## Portfolio standards

This repo showcases the owner's software engineering skills for future jobs, so keep the professional practices visible:

- **Branch + pull request for every change** (never commit straight to `main`), with a PR description: what changed, why, how it was tested. CI must pass before merging.
- **CI** (`.github/workflows/ci.yml`) runs a production-dependency security audit, format check, lint, type check, tests and a production build on every push and PR. Keep it green.
- **Decision records** in `docs/decisions/` (numbered, short: context, decision, alternatives, consequences) for every significant design choice; add a row to `docs/decisions/README.md`. Write them in plain language the owner can explain in an interview.
- **Database changes as versioned migration files** in the repo (`db/migrations/`, applied by `npm run db:migrate`), never only clicked in the dashboard.
- Keep `README.md` current (features, architecture, data model, security, roadmap checkboxes) as milestones land.
- Tests for business logic and security-sensitive code (pricing, units, list building, URL fetching).
- The owner must be able to explain every part, so keep explaining changes as they're made.

## Design (light mode only, built for daylight)

- **iPhone only** (docs/decisions/0056): `proxy.ts` shows other devices `/iphone` (`lib/device.ts`, user agent), except the demo (a `dk_demo` cookie, shown phone-width). On in production, off in `next dev` (`DEVICE_GATE=on` to try it). No zooming: viewport `maximum-scale=1`, `touch-action: manipulation`, `components/NoPinchZoom`. Sign-in forms (`/auth/google`, `/auth/demo`) are plain form posts, never server actions.
- **Always light mode**, even when the phone is set to dark (`color-scheme: light` in `app/globals.css`, `viewport.colorScheme` in `app/layout.tsx`). No dark-mode styles; colors are still named tokens so one could be added later.
- **Colors: violet for actions, green for best price** (docs/decisions/0050, 0055; full guide in `docs/brand.md`), as tokens in `app/globals.css`, used through Tailwind names (`bg-primary`, `text-muted`…), never raw hex codes in components:
  - `--bg` / `--surface` #ffffff (page and cards; cards are set apart by a hairline, not a shade), `--surface-2` #f5f5f5 (quiet fills), `--border` #e6e6e6, `--border-strong` #d4d4d4 (inputs), `--text` #1d1d1d, `--muted` #666666
  - `--primary` #5c5cff (violet, monday.com-inspired, darkened for 4.5:1) with `--on-primary` #ffffff: buttons, the active tab, selected chips, the Today badge, the focus ring. Never decoration.
  - `--accent` #00a960 (green) **only** for the best-price signal, always with ✓ or "BEST". Text on the green is near-black (`text-on-accent`), never white.
  - `--success` #00a960 and `--info` #6a9bcc are for fills and icons only; for text use `--success-text` #007a45 and `--info-text` #3b6896.
- **Shared building blocks** (`@layer components` in `app/globals.css`): `btn btn-primary` / `btn btn-secondary`, `card`, `field`, `heading-1` (page titles), `heading-2` (section titles), `label` (small mono uppercase), `chip` / `chip-on`. Use them instead of repeating class lists. Cards 12px corners, buttons and chips pill-shaped, inputs 8px, no shadows.
- **Sunlight rule:** every text color must reach 4.5:1 contrast on its background, and meaningful outlines and bars 3:1. `lib/contrast.test.ts` reads `globals.css` and checks every text/background pair; add new pairs there when adding a text color.
- **Look: clean, minimal, current** (in the spirit of stackai.com, not its brand): white space, near-black type, hairline borders, violet for actions and green for best price, each used sparingly. No clip-art icons for branding.
- **Tabs (three, bottom bar):** Plan · Grocery · Recipes, Grocery in the middle (docs/decisions/0048, replacing 0036), defined once in `lib/tabs.ts` (`TABS`, `HOME_TAB` = Grocery by id, not position). Opening the app lands on Grocery (`/` redirects; the home-screen `start_url` is `/grocery`); a partner who just joined lands on Plan, where the welcome is. Tab pages live in `app/(tabs)/`, share the `TabBar` and a `loading.tsx` skeleton, and use `components/ui/TabPage` (title as `heading-1`, ⚙︎ top-right linking to `/settings?from=<tab>`; Settings' back link returns to that tab, unknown values fall back to Grocery). The active tab shows an accent bar, darker text and `aria-current`, never color alone. Pages inside a tab use `components/ui/SubPage` (back link + title).
- **Grocery tab** (`/grocery`, docs/decisions/0035, layout from 0050), list first: one compact row of three equal secondary buttons (**Price book** `/grocery/prices`, **Log price** `/grocery/log`, **Scan receipt** `/grocery/receipt`), then the **Grocery list** (add box at its top, grouped by store section) and **In stock** (`#in-stock`). Ticking a list item moves it In stock (`set_in_stock`), with an Undo; × removes it. Grocery rows: checkbox, item, where it's **cheapest now** (each store's latest price, then the lowest: `item_cheapest_now`; "older" after 90 days; nothing if unpriced), ×. A **Section / Store** toggle groups the list by aisle section or by the store where each thing is cheapest now, with an estimated subtotal per store (`lib/shopTrip.ts`, docs/decisions/0052). (`/grocery/prices?item=<id>#item-<id>` still scrolls to and outlines a price book row.) Price book rows compare stores (docs/decisions/0044): on the left the item, its unit and **Log price** (the item's price form); on the right a small chip per store with its latest price, stacked cheapest first, the cheapest marked ✓ with an orange outline (`pricesByStore`). Prices per item show whole cents. `/grocery/stock` redirects.
- **Logo:** `components/ui/Wordmark` (sizes `lg`, `sm`), type only: "DIALED" in medium, widely spaced Inter capitals over a smaller, wider-spaced DM Mono "KITCHEN". Use it on the sign-in screen and in headers; never retype the name by hand.
- **App icon:** a minimal shopping cart, one continuous violet line with a violet and a green dot wheel, on white; brand colors only (docs/decisions/0047, 0055; for the icon only, not the wordmark). Never a copy of another brand's logo. Source: `assets/app-icon.svg` (no `--` inside SVG comments, or the renderer fails). Phones use plain PNGs in `public/` (`apple-touch-icon.png` 180 + a `-precomposed` copy, `icon-192.png`, `icon-512.png`), linked in `app/layout.tsx` metadata and `app/manifest.ts` (180 first). After changing the SVG: `npm run icons`, bump `ICON_VERSION` in `lib/iconVersion.ts` (the `?v=` on icon links, so phones fetch the new file), commit the PNGs; `lib/appIcon.test.ts` checks sizes, no metadata and the manifest. `proxy.ts` must skip image files: a signed-out phone fetching the icon must get the PNG, not a redirect to /login. iPhones cache home-screen icons: delete and re-add the icon after a change.
- **Fonts (two only):** Inter for everything readable (the default `font-sans`; titles at weight 500, slightly tight letter-spacing), and DM Mono (`font-mono`) for small uppercase labels only (`label`), never sentences. See docs/decisions/0050 (replacing the fonts in 0008).
- Body text 17px or more; tap targets 48px or more (one hand, holding a basket). Color is never the only signal: pair it with text or an icon (🎉, ✓, strikethrough).
- **Food emojis:** every food name (list, In stock, price book, recipe ingredients) shows `components/ui/FoodEmoji`, worked out from the name by `lib/foodEmoji.ts` (last food word wins; no emoji when unsure or when the name already has one; docs/decisions/0023). Add new foods there, with a test. Custom item photos and emojis were removed from the app (docs/decisions/0039); `items.emoji` and `item_photos` stay in the database, unused.
- No Anthropic logo or name in the app; only the colors.

## Planned features and data model

- **"Try the demo"** (docs/decisions/0026): one shared password account (`demo@dialed-kitchen.vercel.app`, password only in `DEMO_PASSWORD` env) with sample data reset daily on sign-in (`refresh_demo_if_stale`); only Google can create other accounts; the demo can't invite and gets 10 AI requests a day. Every UPDATE/DELETE in a function keeps a WHERE (a guard carried over from Supabase): `db/tests/safeUpdates.test.ts` checks every function.
- **At most 25 accounts** (personal and portfolio app, not a public service): the sign-up gate (`private.check_signup`, asked by Neon Auth's webhook before any account is created; docs/decisions/0049) refuses the 26th; the sign-in page explains it (docs/decisions/0025). Raising it needs a migration.
- **Invite-only sign-up** (docs/decisions/0043): anyone can join the waitlist (`/waitlist`, `join_waitlist`); only the admin (Google account saltylvn@gmail.com, "tylerpclark", in `private.admins`) sees it at `/admin` (linked from Settings, "not found" for others) and approves, which makes a 16-character code (`lib/signupCodes.ts`) shown once; only its SHA-256 hash is stored in `signup_invites`, tied to the email, single-use, 7 days. Accounts + open codes never exceed 25. The person enters the code on the sign-in page ("Have an invite code?", `redeem_signup_invite`), then continues with Google; the sign-up gate refuses any new account without a redeemed code ("Invite required" → `/login?error=invite`), except the admin and the demo. Partners need a code too. Test users get an invite automatically (`createUser(..., { invited: false })` to test without).
- **Partner sharing (married couples only; the only kind of sharing):** all data belongs to a `household`, not a user. Every new user gets a household of one. A spouse joins **only by invitation**:
  - The invite is tied to the spouse's email and only works when they sign in with that email.
  - Invite links are single-use, expire after 7 days, and are stored only as a hash.
  - One open invite at a time.
  - **At most two members per household, and each person belongs to exactly one household.** Both rules are enforced by database constraints, not just app code.
  - No other sharing (no families, friends, guests or roles). The UI calls it **Partner**.
  - Either partner can leave: the shared data stays with the household's creator, and the one who leaves starts fresh. A joining partner's old solo data stays private, never merged.
  - Every data table has `household_id`, with RLS allowing only that household's members.
- **Groceries:** `stores` is a **fixed list of six, in this order: WinCo, Trader Joe's, Harmons, Smith's, Costco, Walmart** (database-enforced: seeded per household, check constraint, read-only to the app; changing it needs a migration; docs/decisions/0012). `items` (one row per thing you buy: name, one comparison unit: per lb, per fl oz, or each).
- **Receipts** (docs/decisions/0033): `/grocery/receipt` ("Scan a receipt" on Grocery and the Price book; camera only, `capture="environment"`, up to 3 shots, docs/decisions/0035). Gemini reads the lines (`lib/ai/receiptFromImage.ts`, one AI request), `suggestItem` matches each to the price book, the person reviews, `saveReceipt` creates new items, inserts all prices in one insert, then `restock(names)` puts everything bought In stock and off the grocery list (docs/decisions/0052). Matches are remembered per store in `receipt_aliases` (text in `receiptKey` form). Real-Gemini check: `NETWORK_TESTS=1 npx vitest run lib/server/gemini.network.test.ts`.
- **Price forms** have no "On sale" box and the package size as swipe wheels (`SizeWheels`: amount 0–500 starting at 1, fraction ¼ ⅓ ½ ⅔ ¾, unit starting at oz / fl oz / each for the item's kind, only that kind offered); the price wheels start at the last price for one of that unit (`startingPrice` in `lib/packageSize.ts`; docs/decisions/0039, 0040). They put the store and price wheels side by side (`StoreWheel` "words" text size, `PriceWheel`; 5 rows; no forced stop per row, so flicks are fast). Stores on the wheel: Trader Joe's, WinCo, Harmons, Smith's, Costco, Walmart (`LOG_STORES`, all six), starting at Trader Joe's (docs/decisions/0032, 0035).
- **Prices:** `item_prices` (item, store, price, package quantity + unit, date). **Sales aren't tracked** (docs/decisions/0046): nothing records or shows "on sale"; a receipt's printed discount is still subtracted, so the price is what was paid; the old `on_sale` column stays in the database, unused. Every price is kept as history. **Best price** = the lowest unit price ever entered for the item, computed from the history (not stored), shown with store and date in the price book (the grocery list and the week's cost use **cheapest now** instead, docs/decisions/0052); prices older than 90 days are marked "older". Entering a price shows "🎉 New best price!" or "X% more than your best". Unit-price math in `lib/pricing.ts` with tests; an index keeps the best-price lookup fast.
- **Grocery lists:** `grocery_lists`, `grocery_list_items` (item, amount, checked, source: manual or meal plan). **One entry per name** (`private.ingredient_key`, unique index; docs/decisions/0038): a second "Bananas"/"bananas, ripe" is refused. `createTestDb({ stopBefore })` + `migrateRest()` test a migration against older data. Shopping mode with big checkboxes, best price and "last here" price per item.
- **Recipes:** `recipes` (title, servings, steps, source, meals (any of Breakfast, Lunch, Snacks, Dinner; empty = Not sorted yet; the Recipes tab is grouped by meal, with quick-sort chips on unsorted cards, and a Plan spot offers only that meal's recipes, then unsorted; docs/decisions/0021), optional calories / protein / carbs / fat per serving: typed, from imports, or "Estimate with AI"; docs/decisions/0018), `recipe_ingredients` (linked to `items`, amount, unit). Import from a URL by reading the page's schema.org Recipe data (no AI). Import from photos (up to 3: a cookbook/magazine page, recipe card or screenshot) via Gemini, always shown as an editable form before saving (docs/decisions/0016).
- **Calorie counting** (docs/decisions/0051): `food_log` (one row per thing a person ate: day, meal, planned meal or typed, portion, calories/macros snapshotted when logged) and `nutrition_goals` (calories + optional protein per person). **Private to each person** (RLS `user_id = auth.uid()`), unlike the rest of the household's data. Written only through `log_planned_meal` (usual portion = the person's last portion of that recipe), `log_day_as_planned`, `log_quick` and `set_my_goal`. The Today card on Plan (`features/food-log/components/TodayCard`) shows left/over vs goal and names meals without calories, never counting them as 0.
- **Meal plan:** `meal_plan_entries` (date, meal, recipe, servings, `leftover_of`: leftovers of another planned meal, same recipe, counted in the week's groceries; docs/decisions/0053). **Repeat last week** (`copy_plan_week`, skips what's already planned) and **Leftovers** (`plan_leftovers`, a later day this week) on Plan; the picker shows "N of M in stock"; `households.weekly_budget` (set via `set_weekly_budget`) is compared on the groceries card. **Meals are exactly Breakfast, Lunch, Snacks, Dinner, in that order (snacks after lunch, before dinner); every day on the Plan tab always shows those four spots** (tap a spot, then pick the recipe and servings by swipe wheel). Under the spots, two dropdowns, **Calories** and **Macros**, total the day per person (one serving of each meal) and name meals without numbers. → generate a grocery list (ingredients summed across recipes) with an estimated cost from best/latest prices.
- **Units:** conversions in `lib/units.ts` with tests; anything that can't be converted is listed separately, never guessed. Size menus also offer package sizes like "½ gal" (`PACKAGE_SIZES`, `choicesFor`), turned into real units by the form schemas (`resolveChoice`); amounts accept fractions ("1/2", "1½") via `readAmount` (docs/decisions/0037).

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, Neon (Postgres, the Data API for queries, Neon Auth for Google sign-in; docs/decisions/0049), Google Gemini free tier (server-side only), Vercel Hobby. All free tier.

## Security

- Row-level security on every table; every row belongs to one household and only that household's members can read or change it.
- Validate every form and server-action input (zod) before it touches the database.
- Secret keys only in `.env.local` (git-ignored) and Vercel; never in browser code.
- AI is called only from the server, its JSON reply validated before use, with a daily per-user limit.
- **Fetching any link a person supplies goes through `lib/server/safeFetch.ts` `fetchPublicPage`** (docs/decisions/0015): https on 443 only, public addresses only, checked inside the connection's own DNS lookup (no DNS rebinding), redirects checked per hop, 10 s / 3 MB / HTML only. Never `fetch()` a user-supplied URL directly. Identify honestly; never try to get around a site's bot protection.
- **AI** (docs/decisions/0016): only `lib/server/gemini.ts` talks to Google; `GEMINI_API_KEY` lives only in `.env.local` and Vercel (Sensitive). Replies are checked by `lib/ai/recipeFromImage.ts` (zod) before use. Each AI request (photo read or nutrition estimate, `lib/server/aiLimit.ts`) costs one of 40 per person per rolling 24 hours, counted atomically by the database (`take_ai_request`). Recipe photos are shrunk to JPEG on the phone, checked by their bytes on the server (`lib/photos.ts`), sent to Gemini, and never stored.
- Set a secret locally without it showing on screen or in shell history: `sh scripts/set-secret.sh NAME`; copy it to Vercel (Production and Preview, Sensitive): `sh scripts/vercel-secret.sh NAME`.

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
lib/                 pure logic with no I/O (pricing, units, dates, contrast), unit tested
lib/server/          server-only infrastructure: the database client, Neon Auth, env validation
db/migrations/       versioned SQL: tables, indexes, RLS policies
docs/decisions/      decision records
```

Every request flows through the same layers; each one checks something:

1. **UI** (`components`, server components by default; `"use client"` only for interactivity) never talks to the database directly.
2. **Server action / page** parses input with the feature's zod schema (reject, don't fix up) and confirms the signed-in user.
3. **Data access layer** (`queries.ts`, `actions.ts`) is server-only, uses the request's database client (`lib/server/db.ts`: Neon's Data API with the user's own token, so RLS applies; never the owner connection for user data) and returns only the fields the UI needs.
4. **Postgres RLS** is the final guard: every table has `household_id` and policies so only that household's members (the couple) can touch its rows, even if app code has a bug.

Rules:

- Validate at every trust boundary: form input, URL params, AI replies, fetched web pages. Types are not validation.
- Server actions return a typed result (`{ ok: true, data } | { ok: false, error }`) with a user-friendly message; log details on the server, never send stack traces or database errors to the browser.
- Secrets are read only in `lib/server/env.ts` (validated with zod); nothing is `NEXT_PUBLIC_`: the browser never talks to Neon directly.
- Database: migrations are append-only (never edit one that has been applied); foreign keys with explicit `on delete`; `check` constraints for invariants (price > 0, quantity > 0); money as `numeric(10,2)`, never floating point in the database.
- Accessibility: semantic HTML (real `<button>`, `<label>` for every input), visible focus, 48px+ targets.
- **Choosing one of several values uses a swipe wheel** (the owner's preference): a native `<select>` (iPhone shows its wheel) for named options like stores and meals, `components/ui/WheelPicker` for numbers like the price (dollars and cents wheels). The wheel only changes its value from the person's own scrolling.
- **No inline `style` attributes** (lint-enforced): the CSP blocks them in production, where they silently do nothing. Use Tailwind classes.
- TypeScript is strict (incl. `noUncheckedIndexedAccess`); no `any`; avoid `as` casts except at a validated boundary.

## Performance (speed is a feature: the app is used in the store, often on cellular)

Targets: every tap responds instantly (under 100 ms visual feedback); pages usable in under 1.5 s on a phone over 4G; Lighthouse mobile performance 95+.

- **Ship little JavaScript:** server components by default; `"use client"` only on the small interactive leaf (a checkbox, a sheet), never on a whole page. No heavy libraries for small jobs (dates, formatting: use `Intl`).
- **Instant feedback:** every route has a `loading.tsx` skeleton; checking off list items and saving prices update the screen immediately (optimistic UI with `useOptimistic`) and roll back with a message if the save fails.
- **Few round trips:** fetch on the server, independent reads in parallel (`Promise.all`), one query per screen where possible (joins or a database view over many small queries), never queries in a loop (N+1).
- **Lean queries:** select only the columns the screen needs; index every foreign key and every column used to filter or sort; paginate long lists (price history).
- **Cache what's safe:** static assets and fonts are cached by Vercel's CDN; user data is per-request (never cached across users).
- **Images:** `next/image` with explicit sizes; recipe photos shrunk in the browser (1600 px JPEG, ≤1.2 MB) before upload.
- Measure, don't guess: check Lighthouse on the deployed site after each milestone, and the build output's route sizes in PRs.

## Conventions

- Dates are stored as the user's local calendar date, not UTC timestamps.
- Check the bundled docs in `node_modules/next/dist/docs/` before using a Next.js API (see `AGENTS.md`).
- Add dependencies only with the first code that uses them; prefer the platform and existing deps over new packages.
- Small, focused commits with clear messages; one concern per pull request.

## Commands

- `npm run dev`: start the local dev server
- `npm run build`: production build
- `NETWORK_TESTS=1 npx vitest run lib/server/safeFetch.network.test.ts`: real-internet checks of the safe fetcher (not in CI); `lib/server/gemini.network.test.ts` likewise reads a test receipt with the real Gemini
- `npm test`: run unit tests (vitest; `vitest.config.mts` maps the `@/` imports). Browser-only values such as the phone's date come from hooks like `components/useToday` (`useSyncExternalStore`), not `setState` in an effect.
- `npm run lint`: lint
- `npm run typecheck`: TypeScript check
- `npm run format` / `npm run format:check`: Prettier
- CI runs: audit, format check, lint, typecheck, tests, build. Run the same locally before pushing.
- **Database changes:** add a new file in `db/migrations/` (`YYYYMMDDHHMMSS_name.sql`; never edit one already applied), cover it in `db/tests/` (real Postgres via PGlite: `createTestDb()`, `db.as(user, sql)` runs with RLS as that user; `createUser` signs someone up the way Neon Auth and the webhook do), then apply it: Claude runs `npm run db:status`, shows the owner exactly which migrations will apply, and runs `npm run db:migrate` once the owner agrees, then `neon data-api refresh-schema` so the Data API sees the change. The Neon CLI is logged in and this folder is linked (`.neon`, git-ignored) to project `dialed-kitchen` (`red-hill-13900366`), branch `main`. Neon manages the `neon_auth` schema: read and reference its tables, never add triggers to them or alter them.
- **Sign-up path** (docs/decisions/0049): Neon Auth calls `app/webhooks/neon-auth` before (`user.before_create`) and after (`user.created`) creating an account; the route checks Neon's signature (`lib/security/webhookSignature.ts`), then asks `private.check_signup` / `private.finish_signup` as the `signup_gate` database role (`lib/server/signupGate.ts`; password via `npm run db:gate-password`). If the webhook is unreachable, sign-ups are refused.

## Roadmap

0. Project setup ✅ (Next.js, colors and fonts, contrast test, GitHub repo, README, CI, decision records; live at https://dialed-kitchen.vercel.app, deployed by Vercel on every push to `main`)
1. Google sign-in, the wordmark, and the tab layout (Plan · Recipes · Grocery) ✅
   1b. Partner sharing: households, invite-only partnership for a married couple ✅
2. Stores, items and price entry with unit prices, best price, "New best!" and history ✅
3. Grocery list with shopping mode ✅ (one shared list; List | Prices views; last price at the chosen store)
4. Recipes entered by hand ✅ (typed ingredient lines, favorites, expand to cook, add to list)
   4b. "In stock" ✅ (the owner's term, never "have it"): one shared inventory (`pantry_items`); tick In stock on a recipe ingredient or a list entry, and it leaves the grocery list; Clear checked puts bought items In stock; recipes add only what's needed, never duplicates; the Grocery page lists Grocery list · In stock, and ticking moves an item In stock (docs/decisions/0030, 0035). Names match by `matchKey` / `private.ingredient_key` (docs/decisions/0014).
5. Recipe import from a website link ✅ (schema.org Recipe data, SSRF-safe fetch; sites that block apps get a clear message)
6. Recipe import from a photo ✅ (Gemini free tier with model fallback; up to 3 photos; 40 a day per person; photos never stored)
7. Weekly meal planner ✅ (seven days from today via `?start=`, today on top, ‹ › jump 7 days; docs/decisions/0054; every day has four spots, Breakfast · Lunch · Snacks · Dinner; recipe and servings by wheel; regulars = planned 3+ times in 8 weeks join favorites; docs/decisions/0017)
   7b. Calories and macros ✅ (per serving on recipes; Calories and Macros dropdowns per day on Plan; docs/decisions/0018)
   7c. Calorie counting ✅ (a private food log per person: Today card on Plan with ✓ Ate it, usual portion, Ate the plan and Quick add; daily goal on wheels in Settings; numbers snapshotted when logged; docs/decisions/0051)
8. Meal plan → grocery list with estimated cost ✅ (`week_shopping` / `add_week_to_list`: scaled to planned servings, combined across meals, In stock and on-list skipped, cost at best prices when units convert; "This week's groceries" card on Plan; docs/decisions/0019)
   8b. Recipes sorted by meal ✅ (docs/decisions/0021)
   8c. Smarter shopping ✅ (cheapest now on the list and in the week's cost; By store view with subtotals; receipts restock; docs/decisions/0052)
   8d. Faster planning ✅ (Repeat last week, leftovers linked to their meal, "4 of 5 in stock" in the picker, a weekly household budget on the groceries card; docs/decisions/0053)
9. Polish: price trends and cheapest store per item ✅ (By store · latest price, and a trend sentence + SVG chart on each item page; docs/decisions/0020), app icon ✅. (The meal-prep page, decision 0022, was removed: meal prep is done on Plan; `/plan/prep` redirects; docs/decisions/0041.)
