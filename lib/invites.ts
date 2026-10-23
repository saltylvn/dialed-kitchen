import { createHash, randomBytes } from "node:crypto";

// Invite links: /invite/<token>. The token is 32 random bytes (256 bits): unguessable.
// Only its SHA-256 hash goes to the database, so even someone who could read the database
// couldn't rebuild a working link. (docs/decisions/0009)

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes in base64url, no padding

export function createInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function isWellFormedInviteToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteLink(origin: string, token: string): string {
  return new URL(`/invite/${token}`, origin).toString();
}

// Whole days left before an invite expires (rounded up), from the server's clock. Shown as
// "expires in N days" rather than a date, so it can't be off by a day across time zones.
export function daysUntil(expiresAt: string, now: Date = new Date()): number {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
