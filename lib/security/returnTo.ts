import { isWellFormedInviteToken } from "../invites";

// Where to send someone after they sign in, when they arrived signed out (for example a
// spouse opening an invite link). Stored in a short-lived HttpOnly cookie by proxy.ts and
// read once by /auth/callback.
//
// Only an exact allow-list of paths on this site is accepted, so the value can never send
// anyone to another website (open redirect) or anywhere unexpected.
export const RETURN_TO_COOKIE = "dk-return-to";
export const RETURN_TO_MAX_AGE_SECONDS = 15 * 60;

export function safeReturnPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const match = /^\/invite\/([^/?#]+)$/.exec(path);
  if (match?.[1] && isWellFormedInviteToken(match[1])) return path;
  return null;
}
