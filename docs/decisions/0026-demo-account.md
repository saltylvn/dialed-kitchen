# 0026. A "Try the demo" account for hiring teams

**Status:** Accepted · 2026-10-25 · builds on 0007, 0016 and 0025

## Context

Hiring teams should be able to try Dialed Kitchen in one tap. But the app is deliberately closed: Google sign-in only, at most 25 accounts, and every account is a private household. A demo has to fit those rules without opening a back door.

## Decision

- **One shared demo account,** signed into from a **Try the demo** button on the sign-in page. A server action signs in with the demo password, which is read only from the server environment (`DEMO_PASSWORD`, at least 16 characters; without it the button is hidden). The password never reaches the browser or the repo.
- **Sample data, fresh daily:** on sign-in, `refresh_demo_if_stale()` resets the demo household if its last reset was over 24 hours ago, so there's no scheduled job. The reset replaces it with a price book (9 items, 23 prices across stores and months), 6 recipes, this week's plan, In stock items and a short list. It runs only for the demo account and does nothing for anyone else.
- **No back door:** email sign-in is enabled only so the demo can use a password. The account-creation trigger refuses every non-Google account except the demo's address. That address can't receive mail, so "forgot password" can't take the account over.
- **Guard rails:**
  - the demo can't send partner invites (a database trigger), and Settings explains that instead of showing the form;
  - the demo's AI allowance is 10 a day, shared by all visitors, to protect the free quota;
  - it counts as one of the 25 accounts;
  - a banner on every tab says it's the demo and offers "Leave demo".

## A lesson from testing

The first live reset failed: Supabase refuses an `UPDATE` with no `WHERE` clause (its safeupdate guard), and PGlite has no such guard, so the tests had passed. The fix is a new migration. A new test now reads every function's final code from the database and fails on any unbounded `UPDATE` or `DELETE`.

## Alternatives considered

- **A read-only tour page:** zero exposure, but visitors can't actually use the app.
- **Anonymous sign-ins:** one account per visitor would quickly use up the 25-account limit.
- **A video:** nothing to maintain, but not interactive.
- **A nightly cron to reset:** another moving part and a secret; resetting lazily on sign-in needs neither.

## Consequences

- Anyone can try the full app in one tap; visitors share one demo and may see each other's changes until the next daily reset.
- Raising the demo's AI allowance or changing its address means a migration.
