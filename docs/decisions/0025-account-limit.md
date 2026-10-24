# 0025. At most 25 accounts

**Status:** Accepted · 2026-10-24 · builds on 0009

## Context

Dialed Kitchen is for my household and to show my engineering work. It isn't meant to grow into a public service. Open sign-up means unbounded use of free-tier resources (database rows, the Gemini quota) and more personal data to protect, with no benefit to the project's purpose.

## Decision

- **A hard limit of 25 accounts, enforced by Postgres:** a `before insert` trigger on `auth.users` refuses a new account once 25 exist. It takes an advisory lock first, so two sign-ups at the same moment can't both take the last place. Existing accounts are untouched and keep signing in. Deleting an account frees a place.
- **Partners count too:** a spouse joining by invite needs their own account.
- **A clear message:** when Supabase can't create the account, Google returns to `/auth/callback` with an error instead of a code. If `accepting_new_accounts()` says the limit is reached, the sign-in page explains that this is a personal project not taking new accounts, rather than "try again".
- **No information leak:** `accepting_new_accounts()` answers yes or no, never how many accounts exist. The trigger function can't be called or switched off by app users.

## Alternatives considered

- **An email allow-list:** tighter, but every new person needs a database change. The cap is simpler and enough for a portfolio app.
- **Closing sign-ups in the Supabase dashboard:** an all-or-nothing switch outside the repo, invisible in code review and not tested.
- **A check in app code before sign-in:** Google sign-in creates the account inside Supabase, past any app check. Only the database sees every account being created.

## Consequences

- Cost and exposure are capped for good; the limit lives in a reviewed, tested migration.
- Raising it means a new migration changing the number in both functions.
