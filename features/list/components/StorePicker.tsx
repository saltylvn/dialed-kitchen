"use client";

import { useRouter } from "next/navigation";
import type { StoreRow } from "@/features/prices/schema";

// "Shopping at…": picking a store shows each item's last price there. The choice lives in
// the address (?store=…), so the page is rendered with that store's prices on the server.
export function StorePicker({ stores, current }: { stores: StoreRow[]; current: string | null }) {
  const router = useRouter();
  if (stores.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="shopping-at" className="text-muted shrink-0 text-[15px]">
        Shopping at
      </label>
      <select
        id="shopping-at"
        value={current ?? ""}
        onChange={(e) =>
          router.replace(e.target.value ? `/grocery?store=${e.target.value}` : "/grocery", {
            scroll: false,
          })
        }
        className="border-border bg-surface min-h-12 min-w-0 flex-1 rounded-xl border px-3 text-[17px]"
      >
        <option value="">Any store</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
