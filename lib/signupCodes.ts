import { createHash, randomInt } from "node:crypto";

// Invite codes for new accounts (docs/decisions/0043). The admin sends one by text or email
// and the person types it on the sign-in page, so it must be easy to read aloud and type on
// a phone, yet impossible to guess:
//  - 16 characters from a 32-letter alphabet without look-alikes (no I, L, O, U), shown in
//    groups of four: "7KQM-2HXD-9WPR-4TBN". 32^16 = 2^80 possibilities.
//  - Typing is forgiving: lowercase, spaces and dashes are fine, and O/I/L read as 0/1.
//  - Only the SHA-256 hash of the cleaned-up code is stored.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base 32
const LENGTH = 16;

export function createSignupCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return (code.match(/.{4}/g) ?? []).join("-");
}

// The code as typed → its canonical form, or null if it can't be a code.
export function normalizeSignupCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== LENGTH) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

export function hashSignupCode(code: string): string {
  const normalized = normalizeSignupCode(code);
  if (!normalized) throw new Error("Not a signup code");
  return createHash("sha256").update(normalized).digest("hex");
}
