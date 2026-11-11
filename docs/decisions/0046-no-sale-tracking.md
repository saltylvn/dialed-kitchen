# 0046. Sales aren't tracked

**Status:** Accepted · 2026-11-10 · changes 0033, 0039

## Context

Each price could be marked "on sale". The price form had already lost its On sale box (decision 0039), but receipts still marked printed sales, and the price book, item pages and the price chart showed them as "Sale" tags and hollow dots. The owner doesn't want to track whether a price was a sale: a price is a price.

## Decision

- **Nothing records or shows a sale.** The Sale tags, the price book's "· sale", the chart's hollow dots and their note are gone. The price form no longer accepts the field, and the receipt reader no longer asks Gemini to flag sale lines.
- **Receipts still subtract a printed discount** from the item's price, so what's saved is what was actually paid.
- **No migration.** The `on_sale` column stays in `item_prices`, defaulting to false and unused, like the custom item photos in 0039. Dropping it would need a migration and would lose old data for no gain. It can be removed later if wanted.
- Queries no longer select it, so screens read one column less.

## Alternatives considered

- **Hide the tags but keep recording sales:** keeps data nobody looks at, and the owner asked not to track it.
- **Drop the column:** irreversible, touches the demo-reset functions, and gains nothing today.

## Consequences

- Simpler screens and code; the best price is just the lowest price ever paid, sale or not.
- Old prices keep their stored flag, but it's never read.
