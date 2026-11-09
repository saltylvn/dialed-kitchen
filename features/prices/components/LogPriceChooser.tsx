"use client";

import Link from "next/link";
import { useState } from "react";
import type { Unit } from "@/lib/units";
import type { StoreRow } from "../schema";
import { LogPriceForm } from "./LogPriceForm";

export type LoggableItem = {
  id: string;
  name: string;
  compareUnit: Unit;
  lastUnitPriceBase: number | null;
};

const box = "border-border bg-surface mt-2 min-h-12 w-full rounded-xl border px-3 text-[17px]";

// Log a price for any item (docs/decisions/0035): pick the item (a native menu, so iPhone
// shows its swipe wheel), then the usual price form: store and price wheels, package size,
// sale, date. A new pick starts a fresh form at that item's last price.
export function LogPriceChooser({
  items,
  stores,
  initialItemId,
}: {
  items: LoggableItem[];
  stores: StoreRow[];
  initialItemId: string | null;
}) {
  const [itemId, setItemId] = useState(initialItemId ?? "");
  const item = items.find((i) => i.id === itemId);

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="log-item" className="font-medium">
          Item
        </label>
        <select
          id="log-item"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className={box}
        >
          <option value="" disabled>
            Choose an item
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <p className="text-muted mt-1 text-[15px]">
          Not there yet?{" "}
          <Link href="/grocery/items/new" className="font-medium underline">
            Add a new item
          </Link>
        </p>
      </div>
      {item && (
        <LogPriceForm
          key={item.id}
          itemId={item.id}
          compareUnit={item.compareUnit}
          stores={stores}
          lastUnitPriceBase={item.lastUnitPriceBase}
        />
      )}
    </div>
  );
}
