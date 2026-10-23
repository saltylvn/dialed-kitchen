"use client";

import { useSyncExternalStore } from "react";
import { localToday } from "@/lib/dates";

const noSubscription = () => () => {};

// Today's date on this phone ("YYYY-MM-DD", its own time zone), or "" while rendering on
// the server, which can't know the shopper's time zone. React's built-in way to read a
// browser-only value without an extra render.
export function useToday(): string {
  return useSyncExternalStore(noSubscription, localToday, () => "");
}
