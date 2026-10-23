import { describe, expect, it } from "vitest";
import { createInviteToken } from "../invites";
import { safeReturnPath } from "./returnTo";

describe("safeReturnPath", () => {
  it("allows an invite page on this site", () => {
    const path = `/invite/${createInviteToken()}`;
    expect(safeReturnPath(path)).toBe(path);
  });

  it("refuses everything else, including redirect tricks", () => {
    const token = createInviteToken();
    for (const bad of [
      null,
      "",
      "/",
      "/settings",
      "https://evil.example.com",
      "//evil.example.com",
      `//evil.example.com/invite/${token}`,
      `/invite/${token}/../../settings`,
      `/invite/${token}?next=https://evil.example.com`,
      "/invite/not-a-token",
      `/\\evil.example.com/invite/${token}`,
    ]) {
      expect(safeReturnPath(bad)).toBeNull();
    }
  });
});
