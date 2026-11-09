# 0040. Package size as swipe wheels, starting at 1 ounce

**Status:** Accepted · 2026-11-09 · Changes the package-size field of decisions 0037 and 0039

## Context

In the price form, the store and price are swipe wheels, but the package size was a typed box and a menu. The owner asked for the package size to be wheels too, starting at an amount of 1 and a unit of ounces, so logging is all swiping.

## Decision

- **Three wheels for the package size** (`SizeWheels`), 5 rows tall like the store and price:
  - **Amount**, 0–500, starting at 1.
  - **Fraction**: none, ¼, ⅓, ½, ⅔, ¾, so 1½ lb or 2¼ lb can be logged without typing.
  - **Unit**, starting at **ounces**.
- **The unit wheel shows only units that fit the item**, with "By weight", "By volume" or "By count" under it.
  - A wheel can't grey options out the way the menu did (decision 0039), and a price in another kind of measure is refused.
  - So "ounces" means oz for things priced by weight, fl oz for drinks, and each for things priced per item (`defaultSizeUnit`). "½ gal" stays on the volume wheel (decision 0037).
- **The price wheels start at the last price for one of that default unit** (`startingPrice`), so the starting price and size agree: $3.49/lb starts at $0.22 for 1 oz; a bag of 6 at $5.99 starts at $1.00 for 1 each. Before, they started at the last _package_ price, which next to a size of 1 would have recorded a 6-pack's price for one.
- The wheels send the same `quantity` and `unit` the form always took, so the checks, the ½ gal conversion and the database are unchanged.

## Alternatives considered

- **Starting the size at the last package bought** (say 16 oz): fewer swipes for a repeat purchase, but the owner asked for 1 ounce as the default.
- **A decimal wheel** (.1–.9) instead of kitchen fractions: covers 1.3 lb, but package labels use halves and quarters, and those read better. A weighed item's exact weight still comes in through a receipt scan.

## Consequences

- Logging a price is all swipes: store, price, amount, fraction, unit, then Save.
- Packages are usually bigger than 1 oz, so most entries mean swiping the amount and the price.
