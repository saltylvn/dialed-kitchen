# 0057. The meal plan's cost on Grocery, with AI estimates for missing prices

**Status:** Accepted · 2026-11-21 · Builds on 0019 (week → list), 0052 (cheapest now), 0053 (budget); AI rules from 0016

## Context

The owner wants to plan the week and see, on the Grocery tab, what it will cost against the weekly budget. The cost came only from the price book, and the price book had 11 items for 207 recipe ingredients, so the estimate was mostly "not priced". The owner asked for Gemini to fill in where judgement is needed.

## Decision

- **A meal-plan card at the top of Grocery** for the next seven days (`?start=` today from the phone, like Plan; 0054). It shows "Estimated cost ~$142 of $160 · ✓ within budget", then a breakdown ("$38 from your prices · ~$104 AI estimates · 3 not priced"), **Estimate N missing prices with AI** and **Add N to grocery list**. Plan's groceries card is the same component.
- **Real prices first:** the price book's cheapest-now price (`week_shopping`), then saved AI estimates, then "not priced". The math lives in `lib/weekCost.ts` (pure, tested). It never guesses across measures (cups of something priced per lb).
- **AI estimates, on tap:** one Gemini request covers every planned ingredient still to buy that has no price and no fresh estimate (up to 60). It asks for typical Utah shelf prices per lb, per fl oz or each. The reply is untrusted: `lib/ai/priceEstimate.ts` checks the shape and the ids, keeps prices between $0.01 and $200, and converts them to per gram / ml / item.
- **Saved per household** in `price_estimates` (RLS, shared by the couple) and trusted for 90 days. They're always shown with "~" and "AI estimates", never mixed into the price book. Logging a real price replaces the estimate in the total, because price-book prices come first.
- The request counts against the 40-a-day AI limit (10 for the demo), like photo reads.

## Alternatives considered

- **Estimate automatically on every plan change.** Hands-off, but it spends AI requests on every edit. One tap is cheap and in the owner's control.
- **AI matching of ingredients to price-book items.** It adds little while the price book is small. It could come later, as rules first and AI for the leftovers.
- **Store estimates as price-book prices.** Simpler, but it would blur "I paid this" with "a model guessed this", and the best-price signal would lie.

## Consequences

- The weekly cost is complete enough to compare with a budget, and the label says how much of it is a guess.
- A model's estimate can be off, so prices you log matter more than the estimate and always win.
- One more table and one more AI prompt to maintain. The real-Gemini check is manual (`NETWORK_TESTS`).
