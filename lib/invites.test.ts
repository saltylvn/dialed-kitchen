import { describe, expect, it } from "vitest";
import {
  createInviteToken,
  daysUntil,
  hashInviteToken,
  inviteLink,
  isWellFormedInviteToken,
} from "./invites";

describe("invite tokens", () => {
  it("are 256-bit, URL-safe and different every time", () => {
    const tokens = new Set(Array.from({ length: 200 }, createInviteToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(isWellFormedInviteToken(token)).toBe(true);
  });

  it("hash to the 64-hex-character form the database requires", () => {
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashInviteToken(createInviteToken())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects anything that isn't a token", () => {
    for (const bad of ["", "short", "a".repeat(44), "a".repeat(42) + "/", "../../etc/passwd"]) {
      expect(isWellFormedInviteToken(bad)).toBe(false);
    }
  });

  it("build a link on this site", () => {
    expect(inviteLink("https://dialed-kitchen.vercel.app", "tok")).toBe(
      "https://dialed-kitchen.vercel.app/invite/tok",
    );
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-10-23T12:00:00Z");

  it("rounds partial days up and never goes below zero", () => {
    expect(daysUntil("2026-10-30T12:00:00Z", now)).toBe(7);
    expect(daysUntil("2026-10-23T13:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-10-22T12:00:00Z", now)).toBe(0);
  });
});
