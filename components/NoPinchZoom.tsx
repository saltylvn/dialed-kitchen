"use client";

import { useEffect } from "react";

// iOS Safari ignores `user-scalable=no` for pinches (an accessibility choice by Apple), but
// it still lets a page cancel its own pinch gesture. Dialed Kitchen is sized for the iPhone
// screen with 17px+ text, so pinching only knocks the layout out of place
// (docs/decisions/0056).
export function NoPinchZoom() {
  useEffect(() => {
    const stop = (event: Event) => event.preventDefault();
    const events = ["gesturestart", "gesturechange", "gestureend"] as const;
    for (const name of events) document.addEventListener(name, stop, { passive: false });
    return () => {
      for (const name of events) document.removeEventListener(name, stop);
    };
  }, []);
  return null;
}
