# 0020. Price trends and the cheapest store, per item

**Status:** Accepted · 2026-10-23 · builds on 0003 and 0010

## Context

The price book already shows each item's **best** price ever. In the store, two more questions come up: _where is it cheapest right now?_ and _is it getting more expensive?_ The best-ever price can't answer either: it may be an old one-off sale.

## Decision

- **By store · latest price** (a card on the item page): each of the six stores' **most recent** unit price, cheapest first, with "✓ Cheapest" (ties within half a percent all marked). Stores never priced are listed too ("No price yet"), so you know where you haven't checked. Logic: `lib/priceTrends.ts` `pricesByStore`.
- **Price trend:**
  - One sentence: "↑ Up 25% since Jun 1", "↓ Down 8%…" or "→ About the same…". The arrow and words mean it never relies on color.
  - It compares the latest price with the earliest one in the last 180 days. When several stores were priced on the same day, that day's lowest counts, so a pricier store doesn't fake a rise.
  - Changes under 2% count as "about the same". (`trendSummary`)
  - Below it, a small line chart of every price over time, spaced by real dates, with low and high labels. Sale prices are hollow dots.
- **Built from data the page already loads** (the item's last 100 prices and the stores), so there are no extra queries.
- **Server-rendered SVG, no chart library:** zero extra JavaScript to download, and it uses the app's color classes (the strict CSP forbids inline styles). The chart has an accessible description with the range and the trend.

## Alternatives considered

- **A chart library** (Recharts, Chart.js): tooltips and animation, but 50–100 kB of JavaScript for one small chart, on phones in a store on cellular.
- **Best price per store** instead of latest: answers "where was it ever cheapest", not "where is it cheapest now".
- **A trend over the whole history:** a price from three years ago says little about now; six months matches how often grocery prices move.

## Consequences

- Each item page now answers where to buy it and whether it's rising, with no extra loading.
- A store's "latest" price can be months old; the date is shown under each price.
