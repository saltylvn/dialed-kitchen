# 0028. Choose an item's emoji when the name doesn't give one

**Status:** Accepted · 2026-11-07

## Context

Food emojis are worked out from the name (decision 0023). Names the app doesn't know ("Paper towels", "Dish soap") get none, and now and then the guess isn't the one the household would pick. The owner asked to be able to pick one themselves, from the iPhone emoji keyboard, a sticker, or a photo.

## Decision

- **A custom emoji per price-book item**: a nullable `items.emoji` column (migration `20261107000000_item_emoji.sql`). `null` means "use the one from the name", so nothing changes for existing items and no backfill is needed.
- **Where to choose it:** an Emoji card on the item page (`#emoji`). It shows the current emoji and where it came from, has a box for typing one from the emoji keyboard, and a button to go back to the automatic one. On the Prices view, an item with no emoji at all gets a dashed **＋** spot next to its name that opens that card.
- **Exactly one emoji, checked twice:**
  - The app (zod + `isSingleEmoji` in `lib/foodEmoji.ts`) allows one grapheme that is a pictograph or flag, so 👩🏽‍🍳 and 🇺🇸 count as one, and text is refused.
  - The database refuses anything longer than 16 characters or containing letters, digits, spaces or markup, so even a bug in the app can only store a symbol.
  - Column grants let household members set only this column, and RLS keeps it to their household.
- **Shown wherever the item is known**: the Prices view, the item page and the grocery List (`FoodEmoji`'s `custom` prop). Everywhere else keeps the automatic emoji.
- **Stickers and photos aren't part of this step.**
  - iPhone keyboard stickers are pasted as images, and a web text box only accepts text, so a sticker can't be typed into the box.
  - A photo of the item is the way to get a picture. It needs private storage, upload checks and a content-security-policy change for images, so it comes next as its own change.

## Alternatives considered

- **Custom emoji by name** (a household table keyed by food name): would also cover In stock and recipe ingredients, which aren't linked to items. That's more moving parts for a first step. The item column can be extended later.
- **An in-app emoji grid:** works without the keyboard, but it's a large piece of client code. The iPhone's own emoji keyboard already has search and recents.

## Consequences

- Every item can have an emoji, and the household can fix a wrong guess.
- In stock and recipe ingredients still show only the automatic emoji.
