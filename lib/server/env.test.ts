import { describe, expect, it } from "vitest";
import { parseNeonEnv } from "./env";

const valid = {
  NEON_AUTH_BASE_URL: "https://ep-test-1234.neonauth.us-east-1.aws.neon.tech/neondb/auth/",
  NEON_DATA_API_URL: "https://ep-test-1234.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
  NEON_AUTH_COOKIE_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("parseNeonEnv", () => {
  it("accepts valid settings and trims the trailing slash", () => {
    expect(parseNeonEnv(valid)).toEqual({
      authUrl: "https://ep-test-1234.neonauth.us-east-1.aws.neon.tech/neondb/auth",
      dataApiUrl: valid.NEON_DATA_API_URL,
      cookieSecret: valid.NEON_AUTH_COOKIE_SECRET,
    });
  });

  it("names every missing setting", () => {
    expect(() => parseNeonEnv({})).toThrow(
      /NEON_AUTH_BASE_URL[\s\S]*NEON_DATA_API_URL[\s\S]*NEON_AUTH_COOKIE_SECRET/,
    );
  });

  it("rejects non-https and non-Neon URLs", () => {
    for (const url of [
      "http://ep-x.neonauth.aws.neon.tech/neondb/auth",
      "https://evil.example.com",
    ]) {
      expect(() => parseNeonEnv({ ...valid, NEON_AUTH_BASE_URL: url })).toThrow(
        /NEON_AUTH_BASE_URL/,
      );
      expect(() => parseNeonEnv({ ...valid, NEON_DATA_API_URL: url })).toThrow(/NEON_DATA_API_URL/);
    }
  });

  it("rejects a short cookie secret without repeating it", () => {
    const attempt = () => parseNeonEnv({ ...valid, NEON_AUTH_COOKIE_SECRET: "too-short-secret" });
    expect(attempt).toThrow(/NEON_AUTH_COOKIE_SECRET must be at least 32/);
    expect(attempt).not.toThrow(/too-short-secret/);
  });
});
