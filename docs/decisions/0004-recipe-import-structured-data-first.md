# 0004. Recipe import: structured data first, AI as fallback

**Status:** Accepted · 2026-10-22

## Context
Recipes come from websites, cookbooks, magazines and printed pages. AI can read all of these, but the free tier has daily limits, AI output can be wrong, and sending every import to an AI is slower than needed.

## Decision
- **Website links:** most recipe sites embed a machine-readable recipe (schema.org `Recipe`, as JSON-LD) for search engines. Fetch the page on the server and read that data directly. Use AI only when a page has none.
- **Photos of printed recipes:** send the image to Gemini on the server, validate its JSON reply against a schema, and show the result as an editable form. Nothing is saved until the user reviews it.
- **Server-side fetching is locked down** against server-side request forgery (SSRF): https only, private and local network addresses blocked, short timeout, response size limit.

## Alternatives considered
- **AI for everything:** one code path, but slower, uses up the free quota, and can invent details that the page states exactly.
- **Fetch pages in the browser:** avoids SSRF risk, but most sites block cross-origin requests, so it wouldn't work.

## Consequences
- Most website imports are free, instant and exact.
- AI is kept for what only AI can do (reading photos), and its output is always validated and human-reviewed.
- Because the server fetches URLs a user provides, the SSRF protections are a hard requirement with their own tests.
