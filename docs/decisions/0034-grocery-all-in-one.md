# 0034. Grocery all in one: Grocery list, Shopping kart, In stock

**Status:** Accepted · 2026-11-08 · Replaces the sub-tabs of decision 0030, the cheapest-first order of 0031 and the "Shopping at" picker of 0032

## Context

The comparison exists so the owner can make better choices while shopping, by glancing at prices next to each item. After using the two sub-tabs (Grocery List, Price Tracker) and the "Shopping at" store buttons, the owner asked for something simpler:

- **One page**, not two sub-tabs.
- **No "Shopping at" buttons.**
- **On each row:** the item on the left, a **Log** button in the middle, and the stores' last prices on the right, always **WinCo, Trader Joe's, Harmons** in that order, in italics.
- **A checkbox on the left** that moves an item from the list down to a second list, and no "Checked" tag.
- **Three lists:** Grocery list on top, Shopping kart in the middle, In stock at the bottom, so everything you need, have picked up and already have is in one place.

## Decision

- **The Grocery tab is one page** (`/grocery`): add to the list, then **Grocery list** (grouped by store section), **Shopping kart** and **In stock**.
  - Ticking an item moves it from the list to the kart, and unticking moves it back. It's the same `checked` flag as before, now shown as two lists, with optimistic UI.
  - **"Done shopping"** puts everything in the kart In stock (the existing Clear checked).
- **Each row:** checkbox, item (emoji or photo, name, amount), **Log**, then the store prices (`StorePrices`, also used in the price book).
  - **Fixed order:** WinCo, Trader Joe's, Harmons (`MAIN_STORES`, `mainStorePrices`), so each store is always in the same place and easy to find. This replaces cheapest-first sorting.
  - **The cheapest is marked ✓ and set in medium weight** (and "(cheapest)" for VoiceOver), so the better choice still stands out without moving rows around. Nothing is marked with fewer than two prices.
  - The prices are in **real Poppins italics** (the italic font files are now loaded, about 30 KB, cached), not the browser's slanted imitation.
- **Log opens a sheet** (`ItemSheet`):
  - Price logging with the store wheel (starting at Trader Joe's) and price wheels starting at your last price there, else the most recent anywhere.
  - Below it, the row's other actions: **Mark In stock** and **Remove from list**. They moved here from the row, which no longer has room for them.
  - For an item not in the price book, the sheet offers **Add to price book**.
- **"Shopping at" is gone**, along with its cookie and the "here vs elsewhere" comparison (`compareHere`). Checking off no longer opens the sheet, because without a chosen store there's no store to log at; Log does that.
- **The price book** (`/grocery/prices`) is a sub-page linked from Grocery, next to **Scan a receipt**. It shows every item you've priced, on the list or not, in the same row layout. Item and Add item pages go back to it.
- **The store wheel** gets a "words" text size, so "Trader Joe's" fits on one line in the sheet's narrower wheel.

## Alternatives considered

- **Keeping cheapest-first order:** the cheapest is always on top, but the stores move around from row to row, which is harder to scan in a store. A fixed order with ✓ gives both.
- **Keeping "In stock" and "×" on each row:** one tap less for those actions, but the row then has no room for the name. They're less frequent than ticking and comparing, so they moved into the Log sheet.
- **Dropping the price book page:** the Grocery page only shows what's on the list, in the kart or in stock. Items you've priced but aren't buying now still need a home.

## Consequences

- One page to shop from, with every price on screen: tick, compare, Log.
- Removing an item or marking it In stock takes two taps (Log, then the action) instead of one.
- Decision records 0030, 0031 and 0032 stay as history; this one describes the current layout.
