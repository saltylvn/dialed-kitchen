import { describe, expect, it } from "vitest";
import { createSignupCode, hashSignupCode, normalizeSignupCode } from "./signupCodes";

describe("signup codes", () => {
  it("are 16 characters in groups of four, without look-alike letters", () => {
    const code = createSignupCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  });

  it("are different every time", () => {
    const codes = new Set(Array.from({ length: 200 }, createSignupCode));
    expect(codes.size).toBe(200);
  });

  it("forgive case, spaces, dashes and O/I/L typos", () => {
    expect(normalizeSignupCode("7kqm 2hxd-9wpr 4tbn")).toBe("7KQM2HXD9WPR4TBN");
    expect(normalizeSignupCode("OIL0-0000-0000-0000")).toBe("0110000000000000");
    expect(hashSignupCode("7kqm2hxd9wpr4tbn")).toBe(hashSignupCode("7KQM-2HXD-9WPR-4TBN"));
  });

  it("refuse anything that can't be a code", () => {
    expect(normalizeSignupCode("")).toBeNull();
    expect(normalizeSignupCode("7KQM-2HXD-9WPR")).toBeNull();
    expect(normalizeSignupCode("7KQM-2HXD-9WPR-4TBNX")).toBeNull();
    expect(normalizeSignupCode("7KQM-2HXD-9WPR-4TB!")).toBeNull();
    expect(normalizeSignupCode("UUUU-UUUU-UUUU-UUUU")).toBeNull();
    expect(() => hashSignupCode("nope")).toThrow();
  });

  it("hash to 64 hex characters, which is all the database accepts", () => {
    expect(hashSignupCode(createSignupCode())).toMatch(/^[0-9a-f]{64}$/);
  });
});
