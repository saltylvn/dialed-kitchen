# 0007. Server-side sign-in; no database client in the browser

**Status:** Accepted · 2026-10-22

## Context

Supabase can be used directly from the browser: the page talks to the database API itself, protected by row-level security (RLS). That's quick to build, but it sends the Supabase library (tens of kilobytes) to every phone, lets anyone with the page call the database API directly, and spreads data access across client components.

## Decision

- **All Supabase calls happen on the server:** pages, server actions and route handlers, through `lib/server/supabase.ts` (marked `server-only`, so the build fails if browser code imports it).
- **Google sign-in starts on the server** (`features/auth/actions.ts`) with the PKCE flow: Supabase stores a one-time check code in a cookie, and `app/auth/callback` exchanges Google's code for a session cookie. The callback only ever redirects to fixed paths, so it can't be used as an open redirect.
- **Every request refreshes and verifies the session** in `proxy.ts` (`getClaims()` checks the token's signature). Signed-out visitors are redirected to `/login`.
- **Pages check again** with `requireUser()` (`lib/server/auth.ts`), so a page stays protected even if a request skips the proxy (for example, link prefetches).
- **Settings are validated at startup** (`lib/env.ts`): https Supabase URL only, and a secret key pasted into the public variable is rejected.

## Alternatives considered

- **Supabase client in the browser:** fewer server round trips for some interactions, but more JavaScript on the phone, a direct path from the browser to the database API, and data access spread across components.
- **Rely on the proxy redirect alone:** simpler, but a single layer; the Next.js docs advise also checking authorization where data is read.

## Consequences

- The browser only talks to our own server: the CSP keeps `connect-src 'self'`, and less JavaScript ships to the phone.
- RLS still applies to every query, because the server acts with the user's own session, never a service key.
- Live updates pushed from the database (Supabase Realtime) would need a browser client. If a feature ever needs that, it gets its own decision record.
