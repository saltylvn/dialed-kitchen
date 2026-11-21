import { describe, expect, it } from "vitest";
import { deviceRoute, isIPhone } from "./device";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";
const LAPTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

describe("isIPhone", () => {
  it("is true for Safari, Chrome and the home-screen app on an iPhone", () => {
    expect(isIPhone(IPHONE_SAFARI)).toBe(true);
    expect(isIPhone(IPHONE_CHROME)).toBe(true);
  });

  it("is false for iPads, Android, laptops and no user agent", () => {
    for (const ua of [IPAD, ANDROID, LAPTOP, "", null, undefined]) {
      expect(isIPhone(ua), String(ua)).toBe(false);
    }
  });
});

describe("deviceRoute", () => {
  it("opens the app on an iPhone", () => {
    expect(deviceRoute({ path: "/grocery", userAgent: IPHONE_SAFARI, demo: false })).toBe("app");
  });

  it("shows the iPhone page anywhere else, unless it's the demo", () => {
    for (const ua of [IPAD, ANDROID, LAPTOP]) {
      expect(deviceRoute({ path: "/grocery", userAgent: ua, demo: false })).toBe("iphone-page");
      expect(deviceRoute({ path: "/login", userAgent: ua, demo: false })).toBe("iphone-page");
      expect(deviceRoute({ path: "/grocery", userAgent: ua, demo: true })).toBe("app");
    }
  });

  it("always lets through the iPhone page, the demo sign-in, the sign-in return and the webhook", () => {
    for (const path of ["/iphone", "/auth/demo", "/auth/callback", "/webhooks/neon-auth"]) {
      expect(deviceRoute({ path, userAgent: LAPTOP, demo: false }), path).toBe("app");
    }
    expect(deviceRoute({ path: "/iphones", userAgent: LAPTOP, demo: false })).toBe("iphone-page");
  });
});
