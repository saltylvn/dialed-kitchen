# 0030. Two Grocery sub-tabs: Grocery List (with In stock) and Price Tracker

**Status:** Accepted · 2026-11-07 · Changes the views in decisions 0011 and 0014

## Context

The Grocery tab had three views: List, In stock and Prices. In stock is about the same question as the list ("what do I need?"), so checking it meant switching views mid-shop. The owner asked for two sub-tabs, **Grocery List** and **Price Tracker**, with In stock under Grocery List.

## Decision

- **Two sub-tabs** (`GroceryViews`):
  - **Grocery List** (`/grocery`): **To buy** (the shared list, store picker, check-offs) and then **In stock** (`#in-stock`), on one screen.
  - **Price Tracker** (`/grocery/prices`): the price book (decision 0027).
- **One page, one round trip:** the list and In stock are read in parallel on the server. Both keep their own optimistic UI, and any change refreshes the whole Grocery tab (`revalidatePath("/grocery", "layout")`), so the two sections never disagree.
- **Old links keep working:** `/grocery/stock` redirects to `/grocery#in-stock`.
- **Names follow the owner's words:** "Price Tracker" in the sub-tab, page title and back links.

## Alternatives considered

- **In stock as a collapsed section:** saves space, but hides what you already have at the moment you're deciding what to buy. It can be collapsed later if the screen gets long.
- **Keeping three views:** no work, but not what the owner asked for, and In stock stays one tap away from where it's needed.

## Consequences

- One less view to switch between while shopping.
- The Grocery List page does one more read (In stock) in the same parallel batch, so there's no extra waiting.
