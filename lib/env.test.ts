import { describe, expect, it } from "vitest";
import { parseSupabaseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd1234.supabase.co/",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
};

describe("parseSupabaseEnv", () => {
  it("accepts valid settings and trims the trailing slash", () => {
    expect(parseSupabaseEnv(valid)).toEqual({
      url: "https://abcd1234.supabase.co",
      publishableKey: "sb_publishable_abc",
    });
  });

  it("names every missing setting", () => {
    expect(() => parseSupabaseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL[\s\S]*PUBLISHABLE_KEY/);
  });

  it("rejects a secret key in the public variable", () => {
    expect(() =>
      parseSupabaseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" }),
    ).toThrow(/SECRET key/);
  });

  it("rejects non-https and non-Supabase URLs", () => {
    for (const url of ["http://abcd1234.supabase.co", "https://evil.example.com"]) {
      expect(() => parseSupabaseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: url })).toThrow(
        /NEXT_PUBLIC_SUPABASE_URL/,
      );
    }
  });
});
