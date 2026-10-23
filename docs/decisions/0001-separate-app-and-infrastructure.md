# 0001. A separate app with its own repo, database and hosting

**Status:** Accepted · 2026-10-22

## Context
The owner already runs a fitness and nutrition app (DEVELOP) on the same stack (Next.js, Supabase, Vercel). Dialed Kitchen overlaps a little (food), so it could have been built as a new tab in that app.

## Decision
Build Dialed Kitchen as a fully independent system: its own GitHub repository, its own Supabase project (database, auth, storage), its own Vercel project and its own secrets.

## Alternatives considered
- **A tab inside DEVELOP:** less setup, and meals could feed the calorie log directly. But the two apps would share a database, a deploy pipeline and a blast radius: a bad migration or leaked key in one affects both.
- **One Supabase project, two apps:** saves a free-tier project slot, but mixes two schemas and two sets of security rules in one database.

## Consequences
- Each app can change, deploy and fail independently, and each repo is understandable on its own.
- The Supabase free tier allows two active projects, so this uses the second slot.
- If the apps ever need to share data (for example, logging a planned meal's calories), it will go through an explicit integration instead of a shared database.
