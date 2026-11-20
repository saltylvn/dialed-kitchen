import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

// Checks that a webhook request really came from Neon Auth and wasn't altered or replayed
// (docs/decisions/0049). Neon signs each request with its private key (Ed25519); anyone
// can check the signature with the matching public key, published at the Auth URL's
// /.well-known/jwks.json. The signature also covers a timestamp, so a captured request
// can't be sent again later.
//
// Format ("detached JWS"): the X-Neon-Signature header is `header..signature`, and what
// was signed is `header + "." + base64url(timestamp + "." + base64url(body))`.

export const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

export type WebhookSignatureInput = {
  rawBody: string; // exactly the bytes received, before any JSON parsing
  signature: string | null; // X-Neon-Signature
  timestamp: string | null; // X-Neon-Timestamp (milliseconds)
  publicKey: JsonWebKey; // the key named by X-Neon-Signature-Kid
  now: number;
};

export type WebhookSignatureResult = { ok: true } | { ok: false; reason: string };

export function verifyWebhookSignature({
  rawBody,
  signature,
  timestamp,
  publicKey,
  now,
}: WebhookSignatureInput): WebhookSignatureResult {
  if (!signature || !timestamp) return { ok: false, reason: "missing signature headers" };

  const sentAt = /^\d{1,16}$/.test(timestamp) ? Number(timestamp) : NaN;
  if (!Number.isFinite(sentAt)) return { ok: false, reason: "bad timestamp" };
  if (Math.abs(now - sentAt) > MAX_WEBHOOK_AGE_MS) return { ok: false, reason: "stale timestamp" };

  const parts = signature.split(".");
  const [header, middle, signed] = parts;
  if (parts.length !== 3 || !header || middle !== "" || !signed) {
    return { ok: false, reason: "not a detached signature" };
  }

  if (publicKey.kty !== "OKP" || publicKey.crv !== "Ed25519") {
    return { ok: false, reason: "unexpected key type" };
  }

  const payload = Buffer.from(rawBody, "utf8").toString("base64url");
  const signedPayload = Buffer.from(`${timestamp}.${payload}`, "utf8").toString("base64url");
  try {
    const valid = verify(
      null, // Ed25519 has its own built-in hash
      Buffer.from(`${header}.${signedPayload}`),
      createPublicKey({ key: publicKey, format: "jwk" }),
      Buffer.from(signed, "base64url"),
    );
    return valid ? { ok: true } : { ok: false, reason: "signature doesn't match" };
  } catch {
    return { ok: false, reason: "signature couldn't be checked" };
  }
}
