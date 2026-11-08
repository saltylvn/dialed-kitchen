"use client";

import { useState } from "react";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { storesForLogging } from "@/lib/mainStores";
import type { StoreRow } from "../schema";

// The store for a price, as a swipe wheel like the price itself: Trader Joe's, WinCo,
// Harmons, Smith's, Walmart (lib/mainStores LOG_STORES), starting at the store you're
// shopping at, or Trader Joe's. The form gets the store's id.
export function StoreWheel({
  name,
  stores,
  currentId = null,
}: {
  name: string;
  stores: readonly StoreRow[];
  currentId?: string | null;
}) {
  const { wheel, start } = storesForLogging(stores, currentId);
  const [index, setIndex] = useState(
    Math.max(
      0,
      wheel.findIndex((s) => s === start),
    ),
  );
  const indexes = wheel.map((_, i) => i);

  return (
    <div>
      <input type="hidden" name={name} value={wheel[index]?.id ?? ""} />
      <WheelPicker
        label="Store"
        options={indexes}
        value={index}
        onChange={setIndex}
        format={(i) => wheel[i]?.name ?? ""}
        showLabel={false}
      />
    </div>
  );
}
