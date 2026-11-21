# 0056. An iPhone app: other devices see "Open on your iPhone", and no zooming

**Status:** Accepted · 2026-11-21 · Keeps the demo from 0026 working on a laptop

## Context

Dialed Kitchen is built for one hand in a store aisle: 17px text, 48px targets, an iPhone home-screen app. On a laptop it looked stretched. On the phone, a stray pinch or double tap zoomed the page and knocked the layout out of place.

## Decision

- **iPhone only.** `proxy.ts` reads the browser's user agent (`lib/device.ts`). Anything that isn't an iPhone (laptops, iPads, Android) sees `/iphone` at the same address: "Made for your iPhone", how to open it in Safari and add it to the home screen, and **Try the demo here**.
- **The demo still works anywhere**, for hiring teams. Signing into it sets a small `dk_demo` cookie (HttpOnly, 7 days, cleared on sign-out). With it, a laptop gets the app, shown in a phone-width column.
- Always reachable: `/iphone`, the demo sign-in (`/auth/demo`), the sign-in return (`/auth/callback`) and Neon Auth's webhook.
- The gate is on in production and Vercel previews, and off in `next dev` (turn it on with `DEVICE_GATE=on`), so the app can still be worked on in a desktop browser.
- **"Try the demo" is now a plain form post** (`app/auth/demo`), like "Continue with Google". As a server action, it left the address bar on `/auth/callback`, so "Leave demo" posted there and failed.
- **No zooming:** the viewport sets `maximum-scale=1, user-scalable=no`, `touch-action: manipulation` stops double-tap zoom, and `NoPinchZoom` cancels iOS pinch gestures (Safari ignores `user-scalable=no` for pinches).

## Alternatives considered

- **Phone-width everywhere, nothing blocked.** Friendlier, but not what the owner asked for.
- **iPhone only, demo included.** It would hide the portfolio demo from hiring teams on laptops.
- **Detect by screen size in the browser.** It needs JavaScript before deciding, so the full app would flash first, and it's no harder to fake.

## Consequences

- A user agent can be faked, so this is a convenience gate, not security. Sign-in, the invite gate and row-level security still protect the data.
- The owner and their partner can't use the app on a laptop or iPad, except through the demo.
- Turning off zoom removes a low-vision aid. The app compensates with 17px+ body text, 4.5:1 contrast and large targets.
