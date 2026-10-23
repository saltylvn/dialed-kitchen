# 0005. Feature folders and layered data access

**Status:** Accepted · 2026-10-22

## Context

The app will grow to several features (prices, grocery lists, recipes, meal planning), each with UI, reads, writes and validation. Without a clear structure, database calls and business rules end up scattered across pages, which makes the code hard to review and makes security mistakes easy: one forgotten check can expose another user's data.

## Decision

- **Organize by feature**, not by file type: `features/<feature>/` holds that feature's components, server actions (`actions.ts`), reads (`queries.ts`) and input schemas (`schema.ts`). `app/` holds routes only and stays thin. Pure logic with no I/O lives in `lib/` with unit tests.
- **Every request passes through four layers, each with one job:**
  1. UI: displays data; never touches the database.
  2. Server action or page: validates input with a zod schema and checks the user is signed in.
  3. Data access layer: server-only (`import "server-only"` makes the build fail if it's ever imported into browser code); returns only the fields the UI needs.
  4. Postgres row-level security: the database itself refuses rows that don't belong to the user.

This follows the Data Access Layer pattern the Next.js docs recommend for new projects.

## Alternatives considered

- **Group by type** (`components/`, `actions/`, `queries/` at the top level): common in tutorials, but one feature's code gets spread across many folders, and they grow without bound.
- **Query the database directly in pages and components:** less code at first, but authorization and validation get repeated (or forgotten) in every page.
- **Rely on RLS alone:** RLS is the strongest guard, but validating input and shaping output in app code still matters for good error messages and for not over-sharing data.

## Consequences

- A reviewer can open one folder and see everything about a feature.
- Security is defense in depth: a bug in one layer is caught by the next, and RLS holds even if app code is wrong.
- A little more structure up front, for files that would otherwise be one page component.
