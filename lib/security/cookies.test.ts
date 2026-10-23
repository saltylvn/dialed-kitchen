import { describe, expect, it } from "vitest";
import { hardenAuthCookie } from "./cookies";

describe("hardenAuthCookie", () => {
  it("always hides login cookies from page JavaScript and limits cross-site sending", () => {
    const hardened = hardenAuthCookie({ path: "/", maxAge: 100, httpOnly: false }, true);
    expect(hardened).toMatchObject({ path: "/", maxAge: 100, httpOnly: true, sameSite: "lax" });
  });

  it("requires https in production but not on localhost", () => {
    expect(hardenAuthCookie({}, true).secure).toBe(true);
    expect(hardenAuthCookie({}, false).secure).toBe(false);
  });

  it("can't be weakened by the options passed in", () => {
    const hardened = hardenAuthCookie({ httpOnly: false, sameSite: "none", secure: false }, true);
    expect(hardened).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true });
  });
});
