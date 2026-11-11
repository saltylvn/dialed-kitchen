# Decision records

Short notes on important design choices: the context, what was decided, the alternatives, and the trade-offs. Each is written when the decision is made and isn't rewritten later; if a decision changes, a new record replaces it and links back.

| #                                                              | Decision                                                                              | Status   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| [0001](0001-separate-app-and-infrastructure.md)                | A separate app with its own repo, database and hosting                                | Accepted |
| [0002](0002-light-mode-only-with-tested-contrast.md)           | Light mode only, with contrast checked by a test                                      | Accepted |
| [0003](0003-compute-best-price-from-history.md)                | Compute best price from price history instead of storing it                           | Accepted |
| [0004](0004-recipe-import-structured-data-first.md)            | Recipe import: structured data first, AI as fallback                                  | Accepted |
| [0005](0005-feature-folders-and-layered-data-access.md)        | Feature folders and layered data access                                               | Accepted |
| [0006](0006-security-headers-and-strict-csp.md)                | Security headers and a strict, nonce-based CSP                                        | Accepted |
| [0007](0007-server-side-auth-no-database-client-in-browser.md) | Server-side sign-in; no database client in the browser                                | Accepted |
| [0008](0008-type-only-wordmark-and-two-fonts.md)               | A type-only wordmark and two fonts                                                    | Accepted |
| [0009](0009-partner-sharing-households.md)                     | Partner sharing: households, invite-only, enforced in the database                    | Accepted |
| [0010](0010-units-and-unit-prices.md)                          | Units, unit prices, and a database that keeps prices honest                           | Accepted |
| [0011](0011-one-shared-grocery-list.md)                        | One shared grocery list per household, with instant check-offs                        | Accepted |
| [0012](0012-fixed-stores-and-swipe-wheels.md)                  | A fixed list of six stores, and swipe wheels for choosing                             | Accepted |
| [0013](0013-recipes-typed-ingredients-and-one-step-saves.md)   | Recipes: ingredients typed as text, saved in one step, cooked from in place           | Accepted |
| [0014](0014-in-stock-synced-with-list-and-recipes.md)          | "In stock": one kitchen inventory, kept in step with recipes and the grocery list     | Accepted |
| [0015](0015-safe-recipe-import-from-links.md)                  | Importing recipes from links, safely                                                  | Accepted |
| [0016](0016-recipes-from-photos-with-ai.md)                    | Reading recipes from photos with AI, with a daily limit                               | Accepted |
| [0017](0017-weekly-meal-plan.md)                               | The weekly meal plan: four fixed spots a day, shared by the couple                    | Accepted |
| [0018](0018-calories-and-macros.md)                            | Calories and macros: per serving on recipes, totaled per person on the plan           | Accepted |
| [0019](0019-plan-to-grocery-list.md)                           | From the meal plan to the grocery list, with an estimated cost                        | Accepted |
| [0020](0020-price-trends-and-cheapest-store.md)                | Price trends and the cheapest store, per item                                         | Accepted |
| [0021](0021-recipes-sorted-by-meal.md)                         | Recipes sorted by meal, and a picker that only offers that meal                       | Accepted |
| [0022](0022-meal-prep-view.md)                                 | A meal-prep view: batch cook and prep once                                            | Accepted |
| [0023](0023-food-emojis.md)                                    | Food emojis, worked out from the name                                                 | Accepted |
| [0024](0024-dependency-updates.md)                             | Dependency updates: test each one, hold back what the ecosystem isn't ready for       | Accepted |
| [0025](0025-account-limit.md)                                  | At most 25 accounts                                                                   | Accepted |
| [0026](0026-demo-account.md)                                   | A "Try the demo" account for hiring teams                                             | Accepted |
| [0027](0027-prices-view-from-the-list.md)                      | The Prices view starts from the grocery list, grouped by store section                | Accepted |
| [0028](0028-custom-item-emoji.md)                              | Choose an item's emoji when the name doesn't give one                                 | Accepted |
| [0029](0029-item-photos.md)                                    | A photo per item, stored as a small square in the database                            | Accepted |
| [0030](0030-grocery-list-and-price-tracker.md)                 | Two Grocery sub-tabs: Grocery List (with In stock) and Price Tracker                  | Accepted |
| [0031](0031-main-stores-on-price-tracker.md)                   | Your three main stores on every Price Tracker row                                     | Accepted |
| [0032](0032-shopping-at-a-store.md)                            | Shopping at a store: compare your stores on the list, and log prices as you check off | Accepted |
| [0033](0033-scan-a-receipt.md)                                 | Scan a receipt to log a whole trip's prices                                           | Accepted |
| [0034](0034-grocery-all-in-one.md)                             | Grocery all in one: Grocery list, Shopping kart, In stock                             | Accepted |
| [0035](0035-grocery-list-and-in-stock.md)                      | Grocery list and In stock; prices in the price book                                   | Accepted |
| [0036](0036-tab-order.md)                                      | Tab order: Recipes · Plan · Grocery                                                   | Accepted |
| [0037](0037-half-gallon-and-fractions.md)                      | "½ gal" and typed fractions for package sizes                                         | Accepted |
| [0038](0038-one-list-entry-per-name.md)                        | One grocery list entry per name                                                       | Accepted |
| [0039](0039-simpler-items-and-price-form.md)                   | Simpler items and price form: no custom photos or emojis, no "On sale" box            | Accepted |
| [0040](0040-package-size-wheels.md)                            | Package size as swipe wheels, starting at 1 ounce                                     | Accepted |
| [0041](0041-remove-meal-prep-page.md)                          | Remove the separate meal-prep page                                                    | Accepted |
| [0042](0042-orange-slice-app-icon.md)                          | An orange slice for the app icon                                                      | Accepted |
| [0043](0043-invite-only-sign-up.md)                            | Invite-only sign-up: a waitlist, admin approval and invite codes                      | Accepted |
| [0044](0044-price-book-compares-stores.md)                     | The price book compares stores                                                        | Accepted |
