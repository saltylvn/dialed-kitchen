import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./sameOrigin";

const URL_ = "https://dialed-kitchen.vercel.app/auth/google";

describe("isSameOrigin", () => {
  it("accepts a form posted from this site", () => {
    expect(isSameOrigin("https://dialed-kitchen.vercel.app", URL_)).toBe(true);
  });

  it("rejects other sites, look-alikes and other schemes or ports", () => {
    for (const origin of [
      "https://evil.example.com",
      "https://dialed-kitchen.vercel.app.evil.com",
      "http://dialed-kitchen.vercel.app",
      "https://dialed-kitchen.vercel.app:8443",
    ]) {
      expect(isSameOrigin(origin, URL_)).toBe(false);
    }
  });

  it("rejects a missing or malformed Origin", () => {
    expect(isSameOrigin(null, URL_)).toBe(false);
    expect(isSameOrigin("null", URL_)).toBe(false);
    expect(isSameOrigin("", URL_)).toBe(false);
  });
});
