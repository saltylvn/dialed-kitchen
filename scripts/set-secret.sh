#!/bin/sh
# Saves a secret (like GEMINI_API_KEY) to .env.local without showing it on screen or putting
# it in your shell history. Replaces the line if it's already there.
#   Usage: sh scripts/set-secret.sh GEMINI_API_KEY
set -eu

name="${1:-}"
case "$name" in
  [A-Z]*) ;;
  *) echo "Usage: sh scripts/set-secret.sh NAME   (for example GEMINI_API_KEY)"; exit 1 ;;
esac

cd "$(dirname "$0")/.."

printf "Paste the value for %s (it won't show), then press Return: " "$name"
stty -echo 2>/dev/null || true
trap 'stty echo 2>/dev/null || true' EXIT INT TERM
read -r value
stty echo 2>/dev/null || true
printf "\n"

value=$(printf '%s' "$value" | tr -d '[:space:]')
if [ -z "$value" ]; then
  echo "Nothing pasted, so nothing changed."
  exit 1
fi

touch .env.local
tmp=$(mktemp)
grep -v "^$name=" .env.local > "$tmp" || true
printf '%s=%s\n' "$name" "$value" >> "$tmp"
mv "$tmp" .env.local
chmod 600 .env.local # readable by you only

echo "Saved $name to .env.local (${#value} characters, starting ${value%"${value#????}"}…)."
