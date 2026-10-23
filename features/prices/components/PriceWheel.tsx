"use client";

import { useState } from "react";
import { WheelPicker } from "@/components/ui/WheelPicker";

// The price as two swipe wheels, dollars and cents, starting at a sensible price (the
// item's best so far) so most entries are a small nudge. The form gets it as "12.49".

const DOLLARS = Array.from({ length: 500 }, (_, i) => i); // $0–$499
const CENTS = Array.from({ length: 100 }, (_, i) => i);

export function PriceWheel({ name, initial }: { name: string; initial: number }) {
  const start = Math.round(Math.min(Math.max(initial, 0), 499.99) * 100);
  const [dollars, setDollars] = useState(Math.floor(start / 100));
  const [cents, setCents] = useState(start % 100);

  return (
    <div>
      <input type="hidden" name={name} value={`${dollars}.${String(cents).padStart(2, "0")}`} />
      <div className="flex items-center gap-2">
        <WheelPicker
          label="Dollars"
          options={DOLLARS}
          value={dollars}
          onChange={setDollars}
          format={(d) => `$${d}`}
          showLabel={false}
        />
        <span aria-hidden className="text-[24px] font-semibold">
          .
        </span>
        <WheelPicker
          label="Cents"
          options={CENTS}
          value={cents}
          onChange={setCents}
          format={(c) => String(c).padStart(2, "0")}
          showLabel={false}
        />
      </div>
    </div>
  );
}
