import type { JsonWebKey } from "node:crypto";
import { z } from "zod";
import { verifyWebhookSignature } from "@/lib/security/webhookSignature";
import { getNeonEnv } from "@/lib/server/env";
import { checkSignup, finishSignup } from "@/lib/server/signupGate";

// Neon Auth calls this address around every new account (docs/decisions/0049):
//   user.before_create  "may this person sign up?"  We answer from the database's sign-up
//                       rules (invite-only, Google only, at most 25 accounts). Neon Auth
//                       waits for the answer, and treats no answer or an error as "no".
//   user.created        "this account now exists."  We give it a household and use up its
//                       invite code.
// It is reachable without signing in, so every request must carry Neon's signature, which
// is checked before anything else happens.

const eventSchema = z.object({
  event_type: z.string(),
  user: z.object({ id: z.uuid().optional(), email: z.email().max(254).optional() }).optional(),
  event_data: z.object({ auth_provider: z.string().max(40).optional() }).optional(),
});

const jwksSchema = z.object({
  keys: z.array(
    z.object({
      kid: z.string(),
      kty: z.string(),
      crv: z.string().optional(),
      x: z.string().optional(),
    }),
  ),
});

const MESSAGES = {
  INVITE_REQUIRED: "New accounts are by invitation.",
  ACCOUNT_LIMIT: "Dialed Kitchen isn't taking new accounts.",
  GOOGLE_ONLY: "Only Google sign-in can create accounts.",
  REFUSED: "This account can't be created.",
} as const;

// Neon's public keys, kept for ten minutes so most requests don't fetch them again.
let keys: { byId: Map<string, JsonWebKey>; fetchedAt: number } | undefined;

async function publicKey(kid: string): Promise<JsonWebKey | null> {
  const fresh = keys && Date.now() - keys.fetchedAt < 10 * 60 * 1000;
  if (!fresh || !keys?.byId.has(kid)) {
    // A fixed address from our own settings, never one taken from the request.
    const response = await fetch(`${getNeonEnv().authUrl}/.well-known/jwks.json`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
    const parsed = jwksSchema.parse(await response.json());
    keys = { byId: new Map(parsed.keys.map((key) => [key.kid, key])), fetchedAt: Date.now() };
  }
  return keys.byId.get(kid) ?? null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 64_000) return new Response("Too large", { status: 413 });

  const kid = request.headers.get("x-neon-signature-kid");
  const key = kid ? await publicKey(kid) : null;
  const signature = key
    ? verifyWebhookSignature({
        rawBody,
        signature: request.headers.get("x-neon-signature"),
        timestamp: request.headers.get("x-neon-timestamp"),
        publicKey: key,
        now: Date.now(),
      })
    : ({ ok: false, reason: "unknown key" } as const);
  if (!signature.ok) {
    console.error("Neon Auth webhook rejected:", signature.reason);
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const event = eventSchema.safeParse(body);
  if (!event.success) return new Response("Bad request", { status: 400 });
  const { event_type: type, user, event_data: data } = event.data;

  if (type === "user.before_create") {
    if (!user?.email)
      return Response.json({
        allowed: false,
        error_code: "REFUSED",
        error_message: MESSAGES.REFUSED,
      });
    const decision = await checkSignup(user.email, data?.auth_provider ?? "");
    // Log the decision for audit, without the person's email.
    console.info("Sign-up decision:", decision.allowed ? "allowed" : decision.code);
    return decision.allowed
      ? Response.json({ allowed: true })
      : Response.json({
          allowed: false,
          error_code: decision.code,
          error_message: MESSAGES[decision.code],
        });
  }

  if (type === "user.created") {
    if (!user?.id) return new Response("Bad request", { status: 400 });
    await finishSignup(user.id);
    return new Response(null, { status: 200 });
  }

  // An event this app didn't subscribe to: acknowledge and ignore.
  return new Response(null, { status: 200 });
}
