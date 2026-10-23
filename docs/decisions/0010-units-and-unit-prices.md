# 0010. Units, unit prices, and a database that keeps prices honest

**Status:** Accepted · 2026-10-23

## Context

Comparing prices across stores only works by unit price: a 5 lb bag at $6.49 beats a 2 lb bag at $3.99. Prices arrive in many units (oz, lb, fl oz, gallons, dozens), and both partners enter them. Decision 0003 chose to compute the best price from history rather than store it.

## Decision

- **Eleven units in three dimensions**, each converting to a base unit:
  - weight → grams: oz, lb, g, kg
  - volume → millilitres: fl oz, qt, gal, ml, L
  - count → items: each, dozen

  Units never convert across dimensions. There's no guessing how much a cup of flour weighs.

- **One table, in two languages:** `lib/units.ts` for the app, `private.unit_to_base` / `private.unit_dimension` for the database. A test checks every unit, dimension and factor matches.
- **Each price row's unit price is a generated column** (`unit_price_base`), computed by Postgres from that row alone. It can't be set, and it can't go stale: editing a price recomputes it.
  - The best price is a `security_invoker` view (`item_best_prices`) taking the lowest unit price per item (newest first among equal prices), backed by an index on `(item_id, unit_price_base)`.
  - This is still "computed, not stored" in the sense of 0003: nothing has to be kept in sync.
- **Each item has a dimension and a display unit** (show chicken in $/lb, olive oil in $/fl oz). Triggers stop a price whose unit doesn't fit its item (no pounds of milk), and stop an item switching dimension once it has prices.
- **The database protects the data:**
  - Household-only RLS on stores, items and prices.
  - Composite foreign keys, so a price can only point at an item and store in its own household.
  - **Column-level grants**, so the app can only write the fields people actually fill in. `household_id`, `created_by` and the unit price come from defaults or are computed, and can't be forged.
  - Check constraints on prices, quantities and names. Case-insensitive unique store and item names.
  - A store with price history can't be deleted by accident.
- **Money** is `numeric(10,2)` in the database, never floating point. Dates are the shopper's local calendar date.

## Alternatives considered

- **Convert everything to one unit on entry:** loses what was actually on the shelf tag. The package as bought is better history.
- **Compute unit prices in the app:** every query that ranks prices would need the conversion table, and SQL ordering would be impossible without it.
- **A `best_price` column on items:** goes stale on edits and deletes (see 0003).
- **Table-wide grants, with column revokes:** Postgres doesn't let a column revoke override a table-wide grant, so it would look restricted and not be.

## Consequences

- The best-price lookup is a single indexed query, fast at any realistic size.
- Adding a unit means adding it in both places, and the agreement test fails until both match.
- 18 database tests cover sharing, privacy, forged fields, unit mismatches, best-price ordering and deletion rules.
