import "server-only";
import { fetchWithToken, NeonPostgrestClient } from "@neon/postgrest-js";
import { cache } from "react";
import { z } from "zod";
import { getNeonEnv } from "./env";
import { neonAuth } from "./neonAuth";

// Neon Auth answers a token request with { data: { token }, error }. The SDK doesn't type
// these two calls, so the reply is checked here like any other outside input.
const tokenReplySchema = z.object({
  data: z.object({ token: z.string().min(1) }).nullish(),
  error: z.object({ message: z.string().optional() }).nullish(),
});

async function requestToken(call: unknown, what: string): Promise<string | null> {
  if (typeof call !== "function") {
    console.error(`${what} token: not available in this SDK version`);
    return null;
  }
  const reply: unknown = await call();
  const parsed = tokenReplySchema.safeParse(reply);
  if (!parsed.success || !parsed.data.data) {
    console.error(
      `${what} token failed:`,
      parsed.success ? parsed.data.error?.message : "bad reply",
    );
    return null;
  }
  return parsed.data.data.token;
}

// Signed-out pages (sign-in, waitlist) still call a few database functions. Neon's Data
// API wants a token even then: an "anonymous" one, which maps to the database's
// `anonymous` role. It isn't tied to a person, so one is shared until shortly before it
// expires.
let anonymous: { token: string; expiresAt: number } | undefined;

async function anonymousToken(): Promise<string | null> {
  if (anonymous && anonymous.expiresAt - 60_000 > Date.now()) return anonymous.token;
  const token = await requestToken(neonAuth().getAnonymousToken, "Anonymous");
  if (token) anonymous = { token, expiresAt: tokenExpiry(token) };
  return token;
}

// When a token expires, read from its (unverified) payload. Only used to decide when to
// fetch a fresh one; the Data API is what verifies tokens.
function tokenExpiry(token: string): number {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    );
    if (typeof payload === "object" && payload !== null && "exp" in payload) {
      const { exp } = payload;
      if (typeof exp === "number") return exp * 1000;
    }
  } catch {
    // Unreadable: treat as already expired, so the next call fetches a fresh one.
  }
  return 0;
}

// The token sent with this request's queries: the signed-in person's (so the database
// knows who is asking and row-level security applies), or the anonymous one. Fetched once
// per request (cache), and only when a query actually runs.
const accessToken = cache(async (): Promise<string | null> => {
  const auth = neonAuth();
  const { data: session } = await auth.getSession();
  if (!session?.user) return anonymousToken();
  // No token: the query then fails as "sign-in required" rather than running as someone else.
  return requestToken(auth.token, "Access");
});

// A database client for server code (pages, server actions, route handlers), acting as
// the signed-in user: every query goes to Neon's Data API with their token, so row-level
// security applies. Create one per request; never share one between requests (or users).
export async function createClient() {
  return new NeonPostgrestClient({
    dataApiUrl: getNeonEnv().dataApiUrl,
    options: { global: { fetch: fetchWithToken(accessToken) } },
  });
}
