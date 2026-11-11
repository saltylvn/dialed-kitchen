# 0044. The price book compares stores

**Status:** Accepted · 2026-11-10 · changes 0034, 0035

## Context

Each price book row showed one number, the best price ever, squeezed into a narrow column next to a Log button. Names wrapped, the "BEST" label repeated on every row, and it didn't answer the question I have while planning a trip: where is this cheapest right now, and by how much?

## Decision

- **Each row compares stores:** on the left, the item, its unit and a "Log price" link; on the right, a small chip for every store where it has a price ("✓ Costco $2.29", "WinCo $2.49"…), stacked cheapest first. Keeping the prices small and to the right leaves the name on one line.
- **Latest price per store, not best ever.** It's what a store charges now; the best ever may have been a one-off sale. It reuses the item page's `pricesByStore` (decision 0020) and the existing `item_latest_store_prices` view: three reads in parallel, no new database objects.
- **The cheapest is marked** with ✓, an orange outline and darker text, plus "Cheapest:" for screen readers, so it's never shown by color alone. Ties within half a percent are all marked. Sale and older (90+ days) prices say so in words.
- **A price per item is whole cents** everywhere ($1.00 each, not $0.998). Prices by weight or volume keep a third decimal under a dollar ($0.034/fl oz), where it matters.
- The best price ever, the full history and the trend chart stay on the item page (tap the name).

## Alternatives considered

- **A menu list** (name, dotted line, best price) or **two lines with a + button:** calmer, but still one price per item, so comparing stores means opening each item.
- **Grouping by cheapest store:** good for planning one trip, but it hides the other stores' prices and moves items around as prices change.

## Consequences

- Comparing stores takes one look instead of a tap per item. Rows are a little taller.
- Items with no prices yet say so, so they're still easy to spot and log.
