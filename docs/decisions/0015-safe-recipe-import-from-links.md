# 0015. Importing recipes from links, safely

**Status:** Accepted · 2026-10-23 · builds on 0004

## Context

Pasting a recipe link is the fastest way to add a recipe. But it means our server fetches a page from an address a person typed. That's the classic setup for server-side request forgery (SSRF): a link that points at the server itself, a private network, or a cloud metadata service (`169.254.169.254`) could make the server reach things nobody outside should. Some big recipe sites also block automated requests on purpose.

## Decision

- **Every link is checked before fetching** (`lib/security/fetchUrl.ts`):
  - https only, on port 443.
  - No usernames or passwords in the link, and at most 2,000 characters.
  - No local names (`localhost`, `*.local`, `*.internal`, single-word names).
- **Every address is checked at connect time** (`lib/server/safeFetch.ts`):
  - The DNS lookup used by the connection itself resolves all addresses and refuses unless every one is public (`lib/security/publicAddress.ts`). That covers private, loopback, link-local, carrier-grade NAT, documentation, multicast and reserved ranges, IPv6 equivalents, and IPv4 addresses disguised as IPv6.
  - Because the check happens inside the connection's own lookup, the address checked is the address connected to. That closes **DNS rebinding**, where a name resolves to a safe address for the check and a private one for the request.
  - Literal IP links skip DNS, so they're checked directly.
- **Redirects are followed by hand**, at most 3, and every hop goes through all the same checks.
- **Limits:** 10 seconds, 3 MB, HTML only, uncompressed.
- **The app identifies itself honestly** ("DialedKitchenRecipeImporter/1.0").
  - When a site refuses (401, 403, 429; its bot protection), the person sees: "That site doesn't let apps read its recipes. Type it in below, or add it from a photo once that's available."
  - **We don't try to get around bot protection:** no browser impersonation, no challenge solving. Photo import (Milestone 6) covers those sites.
- **Reading the recipe:** `lib/recipeImport.ts` reads the page's schema.org Recipe data (JSON-LD). It handles nesting (`@graph`), `@type` lists, step sections, HTML entities and broken blocks.
  - Ingredient lines go through the same reader as typed ones (`lib/ingredients.ts`).
  - Values are kept within the app's limits.
  - Pages without recipe data pre-fill the title and link only. Nothing is guessed, and AI arrives with photos in Milestone 6.
- **Nothing is saved automatically:** the import fills the recipe form, and the person checks it and saves.

## Testing

- Unit tests for the address ranges (including mapped IPv4, NAT64 and 6to4), link rules, and recipe extraction.
- Real-internet tests (run with `NETWORK_TESTS=1`, not in CI):
  - a public page is fetched
  - `localtest.me` and `127.0.0.1.nip.io` (public names resolving to `127.0.0.1`) are refused at connect time
  - literal private and metadata addresses are refused
  - a public redirect to `127.0.0.1` is refused at the hop
  - a non-HTML response is refused

## Alternatives considered

- **Fetching in the browser:** no SSRF risk, but cross-origin rules block reading other sites' pages.
- **A third-party "recipe scraper" API:** another service with the user's links, and a cost.
- **Checking the address first, then fetching normally:** open to DNS rebinding between the check and the request.
- **A browser-like user agent or a headless browser to get past bot protection:** circumvents the site's own security decision. Not done.

## Consequences

- Many recipe sites import in a tap. Some major ones refuse, and the app says so plainly.
- Any future feature that fetches a user-supplied link must go through `fetchPublicPage`.
