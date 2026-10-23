# 0006. Security headers and a strict, nonce-based Content Security Policy

**Status:** Accepted · 2026-10-22

## Context

The app will show text from outside sources: recipe pages fetched from the web, AI-read cookbook photos, item names typed by the user. If any of that ever reached the page as code (cross-site scripting, XSS), an attacker's script could act as the signed-in user. React escapes text by default, but defense in depth means the browser should also refuse to run scripts we didn't send.

## Decision

- **Content Security Policy with a per-request nonce** (`proxy.ts`, policy in `lib/security/csp.ts` with unit tests). Each page request gets a fresh random value; Next.js stamps it on its own scripts, and the browser runs only scripts carrying it (plus the scripts those load, via `'strict-dynamic'`). No `'unsafe-inline'` or `'unsafe-eval'` in production.
- Also in the policy: no plugins (`object-src 'none'`), no framing by other sites (`frame-ancestors 'none'`, against clickjacking), forms and `<base>` limited to our own origin, http upgraded to https.
- **Fixed headers on every response** (`next.config.ts`): HSTS (https only, 2 years), `nosniff`, a strict referrer policy, a permissions policy that turns off unused device features (camera stays on for recipe photos), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, and no `X-Powered-By`.
- **Every page renders per request** (`await connection()` in the root layout), which nonces require.

## Alternatives considered

- **CSP without nonces** (`script-src 'self' 'unsafe-inline'`): keeps pages static, but `'unsafe-inline'` lets injected inline scripts run, which removes most of the protection.
- **Hash-based CSP (Subresource Integrity):** keeps static pages with a strict policy, but it's experimental in Next.js 16.
- **No CSP:** relies entirely on never making an escaping mistake.

## Consequences

- Pages can't be served from the CDN as prebuilt static files. That's acceptable here: nearly every page shows the signed-in user's own data, so it would be rendered per request anyway. Static files (JavaScript, CSS, fonts, images) are still CDN-cached.
- Each new outside service needs an explicit entry in the policy. Known upcoming ones:
  - Supabase API calls (`connect-src`).
  - Supabase/Google sign-in redirects: Chrome applies `form-action` to redirects after a form post.
- Vercel's preview-deployment toolbar is blocked by the policy on preview URLs. It's a convenience feature only, and production is unaffected.
- `lib/security/csp.test.ts` guards the policy: a change that adds `'unsafe-inline'` or `'unsafe-eval'` to production fails the tests.
