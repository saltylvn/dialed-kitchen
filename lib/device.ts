// Dialed Kitchen is an iPhone app (docs/decisions/0056). Other devices see "Open Dialed on
// your iPhone" (/iphone), except the shared demo, which hiring teams can try on a laptop.
// The check reads the browser's user agent, which anyone can fake: it's a convenience gate,
// not security. Sign-in and row-level security still protect every household's data.

// Set when someone signs into the demo, so a laptop can show it (in a phone-sized frame).
export const DEMO_DEVICE_COOKIE = "dk_demo";

// Reachable from any device: the iPhone page itself, the demo's sign-in and the sign-in
// return it goes through, and Neon Auth's webhook (a server, not a phone).
const ANY_DEVICE_PATHS = ["/iphone", "/auth/demo", "/auth/callback", "/webhooks/neon-auth"];

// Safari, Chrome and the home-screen app on an iPhone all say "iPhone". iPads say
// "Macintosh" (or "iPad"), so they get the iPhone page too.
export function isIPhone(userAgent: string | null | undefined): boolean {
  return typeof userAgent === "string" && /\biPhone\b/.test(userAgent);
}

export type DeviceRoute = "app" | "iphone-page";

export function deviceRoute({
  path,
  userAgent,
  demo,
}: {
  path: string;
  userAgent: string | null | undefined;
  demo: boolean;
}): DeviceRoute {
  if (isIPhone(userAgent)) return "app";
  if (ANY_DEVICE_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return "app";
  return demo ? "app" : "iphone-page";
}
