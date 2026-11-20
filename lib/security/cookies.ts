// Hardens cookies this app sets itself (the "return to" cookie that remembers an invite
// link across sign-in). Nothing in the browser needs to read them: HttpOnly keeps any
// injected script from reading them. The login cookies are set by Neon Auth's SDK, which
// already makes them HttpOnly, Secure and SameSite=Lax (docs/decisions/0007, 0049).

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  [key: string]: unknown;
};

export function hardenAuthCookie<T extends CookieOptions>(
  options: T,
  isProduction: boolean,
): T & { httpOnly: true; secure: boolean; sameSite: "lax" } {
  return {
    ...options,
    httpOnly: true, // invisible to page JavaScript
    secure: isProduction, // https only once deployed
    sameSite: "lax", // not sent on cross-site requests, except top-level navigation back from Google
  };
}
