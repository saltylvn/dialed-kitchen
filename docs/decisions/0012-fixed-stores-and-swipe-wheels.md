# 0012. A fixed list of six stores, and swipe wheels for choosing

**Status:** Accepted · 2026-10-23

## Context

The owner shops at six stores: WinCo, Trader Joe's, Harmons, Smith's, Costco and Walmart. Typing store names invited typos and near-duplicates, and test stores lingered. In the store, choosing by swiping (the iPhone's wheel) is faster and easier one-handed than typing. That goes for the store, for the price, and later for which meal a recipe is planned for.

## Decision

- **Stores are a fixed list, enforced by the database** (`20261026000000_fixed_stores.sql`):
  - Every household gets exactly the six, created with the household (trigger), with a fixed display order (`sort_order`).
  - A check constraint allows only those six names.
  - The app can read stores but can't add, rename or delete them.
  - Changing the list means a new migration.
- **Choosing is done with wheels:**
  - **Store:** a native `<select>`, which iPhone shows as its own swipe wheel.
  - **Price:** two scroll wheels, dollars ($0–$499) and cents (`features/prices/components/PriceWheel`). They start at the item's latest price, so most entries are a small nudge.
  - The wheel (`components/ui/WheelPicker`) is ported from DEVELOP, with two fixes found in testing:
    - **Only the person's own scrolling changes the value** (touch, mouse wheel, keys). A scroll caused by layout settling could otherwise read the wrong row and silently change the price.
    - **It positions itself before the screen is drawn**, and again when its size changes until it's touched.
  - **Meals in the planner (Milestone 7)** will use the same wheel: Breakfast · Lunch · Snacks · Dinner, in that order.
- **No inline `style` attributes, enforced by lint.** The Content Security Policy (0006) blocks inline styles in production, so the first version of the wheel had zero height there and couldn't scroll. All sizes are CSS classes now, and ESLint (`react/forbid-dom-props`) rejects a `style` prop with a message explaining why.

## Alternatives considered

- **Free-text stores with suggestions** (the previous design): flexible, but typos split one store's price history in two.
- **A per-household "manage stores" screen:** more flexible, but the owner wants exactly these six, and the database rule is simpler and safer.
- **Allowing inline styles in the CSP** (`style-src-attr 'unsafe-inline'`): would make the original wheel work, but loosens the policy for every page to fix one component.
- **A number keypad for the price:** fine, but the owner prefers the wheel, and a wheel can't produce an invalid number.

## Consequences

- Price history per store is always clean: there's one "Costco", ever.
- Adding a store later is a small migration (list, constraint, backfill).
- Every future "choose one of N" control can use `WheelPicker` or a native select.
