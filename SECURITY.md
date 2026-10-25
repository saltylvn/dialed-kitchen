# Security policy

Dialed Kitchen is a personal and portfolio project (sign-up is capped at 25 accounts), but
security reports are welcome and taken seriously.

## Reporting a vulnerability

Please report privately through GitHub: open the **Security** tab of this repository and
choose **Report a vulnerability**. Don't open a public issue for security problems.

Include what you found, how to reproduce it, and what an attacker could do with it. I aim to
reply within a few days.

## What's in place

- Row-level security on every Postgres table, with database tests that act as real users
- A strict nonce-based Content Security Policy and other security headers
- Server-side authentication only; secrets never reach the browser
- SSRF-safe fetching for user-supplied links
- CodeQL code scanning, secret scanning with push protection, and Dependabot security updates

Design details are in the [decision records](docs/decisions/), especially 0006, 0007, 0009,
0015 and 0016.
