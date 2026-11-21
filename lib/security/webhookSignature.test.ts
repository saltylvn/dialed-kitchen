import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MAX_WEBHOOK_AGE_MS, verifyWebhookSignature } from "./webhookSignature";

// Signs the way Neon Auth documents it, with a throwaway key made for the test.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const jwk = publicKey.export({ format: "jwk" });
const NOW = 1_800_000_000_000;
const body = JSON.stringify({ event_type: "user.before_create", user: { email: "a@example.com" } });

function signRequest(rawBody: string, timestamp: string, key: KeyObject = privateKey): string {
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWS" })).toString("base64url");
  const payload = Buffer.from(rawBody, "utf8").toString("base64url");
  const signedPayload = Buffer.from(`${timestamp}.${payload}`, "utf8").toString("base64url");
  const signature = sign(null, Buffer.from(`${header}.${signedPayload}`), key);
  return `${header}..${signature.toString("base64url")}`;
}

const check = (overrides: Partial<Parameters<typeof verifyWebhookSignature>[0]> = {}) =>
  verifyWebhookSignature({
    rawBody: body,
    signature: signRequest(body, String(NOW)),
    timestamp: String(NOW),
    publicKey: jwk,
    now: NOW,
    ...overrides,
  });

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed, fresh request", () => {
    expect(check()).toEqual({ ok: true });
  });

  it("rejects a changed body", () => {
    expect(check({ rawBody: body.replace("a@example.com", "b@example.com") }).ok).toBe(false);
  });

  it("rejects a signature made with another key", () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    expect(check({ signature: signRequest(body, String(NOW), other) }).ok).toBe(false);
  });

  it("rejects a changed timestamp (the signature covers it)", () => {
    expect(check({ timestamp: String(NOW + 1) }).ok).toBe(false);
  });

  it("rejects an old request, even correctly signed (replay)", () => {
    const old = String(NOW - MAX_WEBHOOK_AGE_MS - 1);
    expect(check({ timestamp: old, signature: signRequest(body, old) })).toEqual({
      ok: false,
      reason: "stale timestamp",
    });
  });

  it("rejects missing or malformed headers", () => {
    expect(check({ signature: null }).ok).toBe(false);
    expect(check({ timestamp: null }).ok).toBe(false);
    expect(check({ timestamp: "soon" }).ok).toBe(false);
    expect(check({ signature: "a.b.c" }).ok).toBe(false);
    expect(check({ signature: "not-a-signature" }).ok).toBe(false);
  });

  it("rejects a key that isn't Ed25519", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({
      format: "jwk",
    });
    expect(check({ publicKey: rsa }).ok).toBe(false);
  });
});
