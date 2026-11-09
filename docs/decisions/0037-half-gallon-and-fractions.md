# 0037. "½ gal" and typed fractions for package sizes

**Status:** Accepted · 2026-11-09 · Builds on decision 0010 (units and unit prices)

## Context

Milk and juice often come in half gallons, and the owner wants to log them that way. The size menus only offered whole units (gal, qt, fl oz…), and the amount box only took decimals, so "½ gallon" had to be typed as "0.5" with "gal".

## Decision

- **"½ gal" is a menu choice, not a new unit.**
  - It sits right after "gal" in every size menu: the price form, the add-to-list box and the receipt review (`PACKAGE_SIZES`, `choicesFor` in `lib/units.ts`).
  - When the form is checked, it becomes a real unit: 1 × ½ gal is saved as 0.5 gal (`resolveChoice`). This happens in the validation schemas (`priceFormSchema`, the receipt line schema, `addToListSchema`), so the save actions and the database only ever see real units.
  - Saved, it still reads "½ gal": amounts are shown with kitchen fractions.
- **Amounts can be typed as fractions:** "1/2", "1 1/2", "½", "1½", alongside "2" and "1.5" (`readAmount` in `lib/ingredients.ts`, the same reader recipes use, behind `parseQuantity`). Anything else, like "1/0", "1e3" or "-1", is still refused.

## Alternatives considered

- **A real "half_gal" unit in the database:** clean in the menus, but every unit check, conversion and SQL function would need it, through a migration, for something that is just 0.5 gal.
- **Only accepting typed fractions:** works, but it's two fields to fill for the most common case. The menu choice is one tap.

## Consequences

- Logging a half gallon of milk is one menu choice, and its unit price compares fairly with gallons and quarts.
- Other common sizes (a dozen is already a unit; maybe "½ lb") can be added to `PACKAGE_SIZES` with a test.
