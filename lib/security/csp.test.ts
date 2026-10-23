import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "./csp";

const SUPABASE = "https://abcd1234.supabase.co";

// Splits "a x y; b z" into { a: ["x", "y"], b: ["z"] } so tests can check one directive.
function parse(csp: string): Map<string, string[]> {
  return new Map(
    csp.split("; ").map((part) => {
      const [name = "", ...values] = part.split(" ");
      return [name, values];
    }),
  );
}

describe("buildCsp in production", () => {
  const csp = parse(buildCsp({ nonce: "abc123", isDev: false, supabaseUrl: SUPABASE }));

  it("only runs scripts carrying this request's nonce", () => {
    expect(csp.get("script-src")).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  });

  it("never allows inline scripts or eval", () => {
    const all = [...csp.values()].flat();
    expect(all).not.toContain("'unsafe-inline'");
    expect(all).not.toContain("'unsafe-eval'");
  });

  it("blocks plugins, framing and foreign base URLs", () => {
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
  });

  it("lets forms reach only us and the sign-in chain (Supabase, then Google)", () => {
    expect(csp.get("form-action")).toEqual([
      "'self'",
      "https://abcd1234.supabase.co",
      "https://accounts.google.com",
    ]);
  });

  it("keeps the browser talking only to our own server (Supabase is called server-side)", () => {
    expect(csp.get("connect-src")).toEqual(["'self'"]);
  });

  it("upgrades any http request to https", () => {
    expect(csp.has("upgrade-insecure-requests")).toBe(true);
  });
});

describe("buildCsp in development", () => {
  it("adds only what the dev tools need", () => {
    const csp = parse(buildCsp({ nonce: "abc123", isDev: true, supabaseUrl: SUPABASE }));
    expect(csp.get("script-src")).toContain("'unsafe-eval'");
    expect(csp.get("style-src")).toContain("'unsafe-inline'");
  });
});

describe("createNonce", () => {
  it("is 16 random bytes in base64, different every time", () => {
    const nonces = new Set(Array.from({ length: 100 }, createNonce));
    expect(nonces.size).toBe(100);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });
});
