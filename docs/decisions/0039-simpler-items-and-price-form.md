# 0039. Simpler items and price form: no custom photos or emojis, no "On sale" box

**Status:** Accepted · 2026-11-09 · Retires the app side of decisions 0028 and 0029

## Context

After using the app, the owner found three things unneeded or confusing:

- The **Photo or emoji** card on item pages (decisions 0028, 0029). The emoji worked out from the name is enough.
- The **On sale** checkbox when logging a price.
- The package-size menu showed only the item's own units, unlike the **Compare prices** menu (By weight · By volume · By count).

## Decision

- **Custom photos and emojis are removed from the app:** the item page's card, the price book's ＋ spot, both forms, the photo route, the three save actions, and their helpers and tests. `FoodEmoji` is back to the emoji worked out from the name (decision 0023).
  - **The database keeps the `items.emoji` column and the `item_photos` table**, and their tests. Nothing reads or writes them now, and removing them would delete any saved photos, so that would be its own migration if wanted.
- **No "On sale" checkbox** on the price form or the receipt review lines.
  - Prices logged by hand are saved as not on sale.
  - A receipt line still counts as a sale when the receipt itself prints a sale or discount (decision 0033).
  - Sale prices already saved keep their "Sale" tag.
- **The package-size menu is grouped like Compare prices:** By weight · By volume · By count.
  - Only the item's own kind of measure can be picked; the others are shown greyed out. A price has to be in the same kind of measure as its item, or its unit price couldn't be compared, and the database refuses it ("That unit doesn't fit this item").
  - Greying out, rather than hiding, shows what exists while keeping a mismatched choice from ever reaching Save.

## Alternatives considered

- **Dropping the photo table and emoji column now:** a cleaner schema, but it deletes data. Keeping them costs nothing until a cleanup migration is wanted.
- **Letting any unit be picked, and saving across kinds** (per lb from a per-each price): it can't be converted without weighing the item (decision 0010 never guesses).

## Consequences

- Item pages are shorter: best price, prices by store, trend, Log a price, history.
- Logging a price is store, price, size and date.
- An item priced the wrong way (per each when you buy by the pound) still needs its comparison unit changed, which the database allows only before it has prices.
