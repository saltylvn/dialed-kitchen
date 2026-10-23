# 0016. Reading recipes from photos with AI, with a daily limit

**Status:** Accepted · 2026-10-23 · builds on 0013 and 0015

## Context

Many recipes we cook live in cookbooks, magazines and on recipe cards, and some big recipe sites refuse to let apps read them (0015). Typing a whole recipe on a phone is slow. A vision model can read a photo of the page and fill in the recipe form. That brings new risks: a third-party AI receiving our photos, an answer we can't fully trust, large uploads, and a free quota that one runaway user (or a bug) could use up.

## Decision

- **Google Gemini, free tier, server-side only.** `lib/server/gemini.ts` is the only file that talks to Google (swap providers there). The key lives only in `.env.local` and Vercel (marked Sensitive) and is never sent to the browser.
  - **Model fallback:** free models are sometimes overloaded or retired, so it tries a short list in order (`lib/ai/modelChain.ts`). A key problem (401/403) stops at once; anything model-specific (busy, overloaded, retired, slow) moves on. Each model gets at most 20 seconds and the whole read at most ~50 (the page allows 60).
  - **Structured output:** Gemini must answer in a fixed JSON shape (`responseJsonSchema`), at temperature 0, with instructions to copy faithfully and to ignore any instructions printed in the photo.
- **The answer is untrusted input.** `lib/ai/recipeFromImage.ts` parses it with zod: wrong shapes are refused, whitespace is tidied, and lengths and counts are capped to the app's own limits. Ingredient lines then go through the same reader as typed ones. The result only fills the form; the person checks it and saves.
- **Photos are shrunk on the phone and never stored.**
  - The browser redraws each photo to a JPEG at most 1600 px on its longest side and about 1.2 MB (`PhotoImport`). That's quicker to send and cheaper to read, and redrawing drops hidden data such as GPS location.
  - Up to 3 photos per recipe (multi-page recipes). Server actions accept at most 4 MB per request (`serverActions.bodySizeLimit`; Vercel's cap is 4.5 MB).
  - The server checks the count, size, and that each file really is a JPEG by its first bytes, not its name or claimed type (`lib/photos.ts`).
  - Photos go from the server to Gemini and are discarded; nothing is written to storage.
- **A daily limit, enforced by the database.** Each read costs one of 40 per person per rolling 24 hours. `take_ai_request(limit)` counts and records in one step under a per-person lock, so two taps at once can't both slip under the limit. People can see their own request log but can't add to it or erase it; only the function writes it.
- **Blocked websites point to photos:** the link importer's refusal message now says "Take a screenshot of the recipe and import it from a photo instead."

## Testing

- Unit tests: the model fallback rules, the answer checks (good answers, tidying, caps, wrong shapes, "no recipe", oversized replies), and the photo rules (JPEG by bytes, counts, sizes, scaling).
- Database tests (real Postgres via PGlite): the limit allows up to N then refuses, counts per person, frees up after 24 hours, can't be called signed-out, and the log can't be forged or erased.
- In the browser at phone size: a 4032×3024 photo of a printed recipe filled every field correctly (even when the first two models were busy or slow), and a photo with no recipe gave a clear message without touching the form.

## Alternatives considered

- **Calling Gemini from the browser:** would expose the key.
- **Storing photos** (to show next to the recipe): more privacy risk and storage to manage, for little gain. Can be added later as a deliberate choice.
- **On-device text recognition (OCR) only:** reads the words but not the structure (which lines are ingredients, which are steps); the AI does both.
- **Counting requests in app code** (read the count, then insert): two requests at once could both pass. The database function does it atomically.
- **A paid model:** better accuracy on hard pages, but the app stays on free tiers.

## Consequences

- Cookbooks, magazines, recipe cards and screenshots of blocked sites all import in a tap or two.
- Free-tier models are sometimes slow or busy; the person then sees "try again in a minute" and can always type the recipe in.
- The AI sees our photos; Google's free tier may use inputs to improve its models, so photos of private documents shouldn't be sent.
