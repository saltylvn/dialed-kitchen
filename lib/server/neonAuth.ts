import "server-only";
import { createNeonAuth, type NeonAuth } from "@neon/auth/next/server";
import { getNeonEnv } from "./env";

// The one connection to Neon Auth (Neon's hosted sign-in service, docs/decisions/0049).
// It runs on the server only: it reads and sets the login cookies (HttpOnly, Secure) and
// asks Neon Auth who they belong to. Created on first use so a build without settings
// still succeeds.
let auth: NeonAuth | undefined;

export function neonAuth(): NeonAuth {
  if (!auth) {
    const { authUrl, cookieSecret } = getNeonEnv();
    auth = createNeonAuth({ baseUrl: authUrl, cookies: { secret: cookieSecret } });
  }
  return auth;
}
