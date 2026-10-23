# 0009. Partner sharing: households, invite-only, enforced in the database

**Status:** Accepted · 2026-10-23

## Context

A married couple should be able to share one kitchen: the same plans, lists, prices and recipes. This is the only kind of sharing the app supports. No families, friends or guests, and no roles. Sharing has to be impossible without an invitation, and a mistake in app code must never expose one couple's data to anyone else.

## Decision

- **Data belongs to a household, not a user.**
  - Every user always has exactly one household: their own (created at sign-up by a trigger on `auth.users`), or their spouse's after accepting an invite.
  - Every future data table gets `household_id` with the default `private.current_household_id()`, and RLS lets only that household's members read or change its rows.
- **The rules live in Postgres** (`supabase/migrations/20261023000000_households.sql`), not only in app code:
  - One household per person: a `unique (user_id)` constraint.
  - At most two people: a `before insert` trigger that locks the household row first, so two simultaneous joins can't both get in.
  - One open invite per household: a partial unique index. Creating a new invite cancels the old one.
  - Invites are tied to the invited email (compared to the verified Google email in `auth.users`), are single-use, and expire after 7 days.
- **Invite links carry a 256-bit random token; the database stores only its SHA-256 hash.**
  - The token is created on the server and shown once. Even someone who could read the database couldn't rebuild a working link.
  - The invite page sets `Referrer-Policy: no-referrer` so the token never leaks in a Referer header.
- **No direct table writes from the app.**
  - Members can read their household and its members.
  - The invites table (with its hashes) isn't readable at all.
  - Every change goes through a small set of `security definer` functions that check the caller themselves: `create/revoke/get/accept_household_invite`, `end_partnership`, `get_my_household`.
  - Default execute rights are revoked, and internal helpers live in a `private` schema the API doesn't expose.
- **Ending a partnership** (either partner can): the household and its data stay with the person who created it, and the other partner gets a fresh, empty household. A joining partner's earlier solo data is set aside, never merged.
- **Returning to an invite after signing in:** a spouse who opens the link while signed out is sent back to it after sign-in.
  - The path is kept in a short-lived HttpOnly cookie.
  - It's accepted only if it matches `/invite/<well-formed token>`, so it can't become an open redirect.
- **Tested against real Postgres:** `supabase/tests` runs the real migration in PGlite (Postgres compiled to WebAssembly), with a small stand-in for Supabase's `auth` schema and API roles.
  - The tests try to break every rule: a third member, a second household, the wrong email, an expired or reused invite, direct writes, reading another household.
  - Mutation checks confirmed that removing a rule makes its test fail.
  - No Docker needed, so the tests run in CI.

## Alternatives considered

- **`user_id` on every table, with sharing added later:** simpler today, but retrofitting sharing means rewriting every table, policy and query.
- **A general sharing system (many members, roles, per-item sharing):** far more surface area for security bugs, for a feature the app deliberately doesn't offer.
- **Enforcing the limits only in app code:** one missed check, or a race between two requests, would break the rules. Constraints and a locked trigger can't be bypassed.
- **Emailing invites from the app:** needs an email service and sender-domain setup. Sharing the link by text from the phone is simpler and free.
- **Storing the token itself:** a database leak would expose working invite links.

## Consequences

- Every feature table is household-scoped from the start, using the same two helper functions in its RLS policies.
- Orphaned solo households (from partners who joined someone else) stay in the database, unused. They can be cleaned up later if needed.
- Database changes ship as migration files, applied with `supabase db push`, and are tested before they reach the real project.
