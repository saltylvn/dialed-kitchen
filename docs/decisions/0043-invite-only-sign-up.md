# 0043. Invite-only sign-up: a waitlist, admin approval and invite codes

**Status:** Accepted · 2026-11-10 · builds on 0025, 0026

## Context

Decision 0025 capped the app at 25 accounts, but anyone with a Google account could still take one of those places. I want to choose who gets in: people can ask, and only I approve them. Hiring teams must still be able to look around without asking, through "Try the demo" (0026).

## Decision

- **A waitlist anyone can join** (`/waitlist`: name, email, optional note). It goes through one database function, `join_waitlist`, never a direct insert. The same email twice is quietly ignored, so the form can't reveal who has asked. At most 500 people can wait at once, so the form can't be used to flood the database.
- **One admin**, the Google account saltylvn@gmail.com, shown as "tylerpclark". The admin list lives in a private table the app can't read or change; `private.is_admin()` checks the signed-in account's email. Only the admin can read the waitlist (RLS), approve, decline or remove people, and see the numbers. The `/admin` page answers "not found" to everyone else, and Settings shows its link only to the admin.
- **Approving makes an invite code**: 16 characters such as `7KQM-2HXD-9WPR-4TBN` (2^80 possibilities, no look-alike letters, forgiving to type). The server makes it with `crypto` and shows it to the admin once, with a ready-to-send message. Only its SHA-256 hash is stored. It's tied to the person's email, works once and lasts 7 days. Approving again replaces the old code.
- **Seats are never over-promised**: approving is refused once accounts plus open codes reach 25.
- **The gate is in Postgres.** The same `before insert` trigger on `auth.users` from 0025 now also requires a redeemed, unexpired, unused code for the new account's email, then marks it used. The person enters the code on the sign-in page (which marks it redeemed and says which Google account to use), then continues with Google. Without a code, the sign-in page says new accounts are by invitation and links to the waitlist.
- **Exceptions:** the admin's account and the demo account. Existing accounts are untouched, since the trigger runs only when an account is created.
- **Partners too:** a spouse needs their own code before accepting a partner invite, so every account is one I approved.

## Alternatives considered

- **Checking the code in app code before redirecting to Google:** Google sign-in creates the account inside Supabase, past any app check. Only the database sees every account being created, so the gate has to be there.
- **A code without a tied email:** a forwarded code would let a stranger in. Tying it to the email means only that Google account can use it.
- **An email allow-list edited by migration:** needs a deploy for each person. The waitlist lets me approve from my phone.
- **Storing the code itself:** anyone who could read the database could sign up. With the hash, they can't.

## Consequences

- Every account is one I approved, and the 25 cap still holds; both are tested against real Postgres.
- Signing up takes one more step (enter the code, then Google). The sign-in page explains it.
- Changing the admin needs a migration. Approval emails aren't sent automatically: I copy the message and send it myself, so there's no email service to secure or pay for.
