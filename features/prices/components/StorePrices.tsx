// Your stores' last logged prices for one item, in a fixed order (WinCo, Trader Joe's,
// Harmons; docs/decisions/0034), in italics so they read as reference beside the item.
// The cheapest is marked with ✓ and weight, never color alone. Server-safe (no hooks).
export function StorePrices({
  id,
  stores,
  unitLabel,
}: {
  id?: string;
  stores: { storeName: string; price: string | null; cheapest: boolean }[];
  unitLabel: string | null;
}) {
  if (stores.length === 0) {
    return (
      <p id={id} className="text-muted w-[7.25rem] shrink-0 text-[13px] italic">
        No prices yet
      </p>
    );
  }
  return (
    <div id={id} className="w-[7.25rem] shrink-0 text-[13px] leading-snug italic">
      <ul>
        {stores.map((s) => (
          <li key={s.storeName} className="flex justify-between gap-1 whitespace-nowrap">
            <span className={s.cheapest ? "font-medium" : "text-muted"}>
              {s.cheapest && <span aria-hidden>✓ </span>}
              {s.storeName}
            </span>
            <span className={s.cheapest ? "font-medium" : ""}>
              {s.price ?? <span className="text-muted">—</span>}
              {s.price === null && <span className="sr-only">no price yet</span>}
              {s.cheapest && <span className="sr-only"> (cheapest)</span>}
            </span>
          </li>
        ))}
      </ul>
      {unitLabel && <p className="text-muted text-right">{unitLabel}</p>}
    </div>
  );
}
