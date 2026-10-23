import { formatShortDate, serverToday } from "@/lib/dates";
import { formatUnitPrice, isOlder } from "@/lib/pricing";
import type { Unit } from "@/lib/units";

// "$1.30/lb · Aldi · Oct 3", with Sale and Older tags spelled out (never color alone).
export function BestPriceLine({
  unitPriceBase,
  compareUnit,
  storeName,
  observedOn,
  onSale,
}: {
  unitPriceBase: number;
  compareUnit: Unit;
  storeName: string;
  observedOn: string;
  onSale: boolean;
}) {
  const today = serverToday();
  const older = isOlder(observedOn, today);
  return (
    <span>
      <span className="font-medium">{formatUnitPrice(unitPriceBase, compareUnit)}</span>
      <span className="text-muted">
        {" "}
        · {storeName} · {formatShortDate(observedOn, Number(today.slice(0, 4)))}
      </span>
      {onSale && <Tag>Sale</Tag>}
      {older && <Tag>Older</Tag>}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border text-muted ml-2 inline-block rounded-md border px-1.5 text-[13px] leading-5">
      {children}
    </span>
  );
}
