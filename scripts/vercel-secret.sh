#!/bin/sh
# Copies a secret from .env.local to Vercel (Production and Preview) as a Sensitive value,
# without showing it. Run `npx vercel login` and `npx vercel link` once first.
#   Usage: sh scripts/vercel-secret.sh GEMINI_API_KEY
set -eu

name="${1:-}"
case "$name" in
  [A-Z]*) ;;
  *) echo "Usage: sh scripts/vercel-secret.sh NAME   (for example GEMINI_API_KEY)"; exit 1 ;;
esac

cd "$(dirname "$0")/.."

value=$(grep "^$name=" .env.local 2>/dev/null | head -n 1 | cut -d= -f2-)
if [ -z "$value" ]; then
  echo "$name isn't in .env.local yet. Run: sh scripts/set-secret.sh $name"
  exit 1
fi

for environment in production preview; do
  # Replace any older value, then add this one ("rm" errors just mean there wasn't one).
  # --yes: for Preview, apply to all branches instead of asking which one.
  npx vercel env rm "$name" "$environment" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$name" "$environment" --sensitive --yes
done

echo "Done. Check with: npx vercel env ls"
