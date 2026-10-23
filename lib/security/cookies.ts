// Hardens the login cookies Supabase sets. By default they're readable by page JavaScript,
// because some apps sign in from the browser. This app only talks to Supabase on the server
// (docs/decisions/0007), so nothing in the browser needs them: HttpOnly keeps any injected
// script from stealing the session.

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
