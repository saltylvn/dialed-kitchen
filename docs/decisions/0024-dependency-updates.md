# 0024. Dependency updates: test each one, hold back what the ecosystem isn't ready for

**Status:** Accepted · 2026-10-23 · builds on 0007

## Context

Dependabot had four open pull requests, some weeks old and opened against an older `main`, so their green checks no longer proved anything:

- React 19.2.8 → 19.3.1 (minor)
- ESLint 9 → 10 (major)
- TypeScript 5 → 7 (major; CI failing)
- @types/node 24 → 26 (major)

Major upgrades of build tools can quietly switch off checks we rely on, such as the lint rule that keeps inline styles out (the Content Security Policy blocks them in production).

## Decision

- **Test every update against today's `main`**, not the stale branch: install it fresh, run every CI check, and for runtime libraries click through the app.
- **React 19.3.1: upgraded**, pinned exactly as before. All checks pass, and the app was clicked through on the new version (Plan, recipes, nutrition, In stock) with a clean console.
- **ESLint 10: held back.** `eslint-plugin-react`, `jsx-a11y` and `import` (pulled in by `eslint-config-next`) support ESLint 9 at most; `eslint-plugin-react` provides our inline-style rule.
- **TypeScript 7: held back.** `typescript-eslint` supports TypeScript below 6.1.
- **@types/node 26: held back.** Production runs Node 24 on Vercel. Node's types must match the runtime, or code could use features production doesn't have and only fail once deployed. `package.json` now records `"engines": { "node": "24.x" }`, matching Vercel and CI.
- The holds live in `.github/dependabot.yml` as `ignore` rules, each with the reason and when to lift it. Dependabot **security** updates still come through.

## Alternatives considered

- **Merging the green Dependabot PRs as-is:** their checks ran against old code, and two majors break tooling.
- **Forcing installs past peer-dependency warnings** (`--legacy-peer-deps`): it might appear to work while lint rules silently stop running.
- **Closing the PRs without ignore rules:** Dependabot would reopen them for every new patch release.

## Consequences

- The toolchain stays on versions every plugin supports, with the reasons written down.
- On a Node 26 Mac, `npm install` warns that the project expects Node 24. CI and Vercel use 24.
