# Decision records

Short notes on important design choices: the context, what was decided, the alternatives, and the trade-offs. Each is written when the decision is made and isn't rewritten later; if a decision changes, a new record replaces it and links back.

| #                                                              | Decision                                                                          | Status   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| [0001](0001-separate-app-and-infrastructure.md)                | A separate app with its own repo, database and hosting                            | Accepted |
| [0002](0002-light-mode-only-with-tested-contrast.md)           | Light mode only, with contrast checked by a test                                  | Accepted |
| [0003](0003-compute-best-price-from-history.md)                | Compute best price from price history instead of storing it                       | Accepted |
| [0004](0004-recipe-import-structured-data-first.md)            | Recipe import: structured data first, AI as fallback                              | Accepted |
| [0005](0005-feature-folders-and-layered-data-access.md)        | Feature folders and layered data access                                           | Accepted |
| [0006](0006-security-headers-and-strict-csp.md)                | Security headers and a strict, nonce-based CSP                                    | Accepted |
| [0007](0007-server-side-auth-no-database-client-in-browser.md) | Server-side sign-in; no database client in the browser                            | Accepted |
| [0008](0008-type-only-wordmark-and-two-fonts.md)               | A type-only wordmark and two fonts                                                | Accepted |
| [0009](0009-partner-sharing-households.md)                     | Partner sharing: households, invite-only, enforced in the database                | Accepted |
| [0010](0010-units-and-unit-prices.md)                          | Units, unit prices, and a database that keeps prices honest                       | Accepted |
| [0011](0011-one-shared-grocery-list.md)                        | One shared grocery list per household, with instant check-offs                    | Accepted |
| [0012](0012-fixed-stores-and-swipe-wheels.md)                  | A fixed list of six stores, and swipe wheels for choosing                         | Accepted |
| [0013](0013-recipes-typed-ingredients-and-one-step-saves.md)   | Recipes: ingredients typed as text, saved in one step, cooked from in place       | Accepted |
| [0014](0014-in-stock-synced-with-list-and-recipes.md)          | "In stock": one kitchen inventory, kept in step with recipes and the grocery list | Accepted |
| [0015](0015-safe-recipe-import-from-links.md)                  | Importing recipes from links, safely                                              | Accepted |
| [0016](0016-recipes-from-photos-with-ai.md)                    | Reading recipes from photos with AI, with a daily limit                           | Accepted |
| [0017](0017-weekly-meal-plan.md)                               | The weekly meal plan: four fixed spots a day, shared by the couple                | Accepted |
