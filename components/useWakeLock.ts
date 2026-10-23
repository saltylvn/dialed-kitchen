"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Keeps the phone's screen on while cooking (the browser's Screen Wake Lock API, supported
// by iPhone Safari 16.4+). The lock is dropped by the browser when the app goes to the
// background, so it's taken again when the app comes back; it's released on turning off
// or leaving the page.
const noSubscription = () => () => {};
const isSupported = () => "wakeLock" in navigator;

export function useWakeLock() {
  const supported = useSyncExternalStore(noSubscription, isSupported, () => false);
  const [on, setOn] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);

  const release = useCallback(async () => {
    await lock.current?.release().catch(() => {});
    lock.current = null;
  }, []);

  useEffect(() => {
    if (!on || !supported) return;
    const acquire = async () => {
      try {
        lock.current = await navigator.wakeLock.request("screen");
      } catch {
        setOn(false); // e.g. Low Power Mode: the phone said no
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void release();
    };
  }, [on, supported, release]);

  return { supported, on, setOn };
}
