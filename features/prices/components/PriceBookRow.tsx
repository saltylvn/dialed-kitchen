import Link from "next/link";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { formatShortDate, serverToday } from "@/lib/dates";
import { formatUnitPrice } from "@/lib/pricing";
import type { ItemWithBest } from "../queries";

// One row of the price book (docs/decisions/0035): the item on the left (tap it for every
// store's prices and the history), Log in the middle (log a price at any store), and the
// best price found so far on the right, with its store and date. A link to
// ?item=<id>#item-<id>: the page scrolls to the row and outlines it.
export function PriceBookRow({
  item,
  highlight = false,
}: {
  item: ItemWithBest;
  highlight?: boolean;
}) {
  const best = item.best;
  const year = Number(serverToday().slice(0, 4));
  return (
    <li
      id={`item-${item.id}`}
      aria-current={highlight ? "true" : undefined}
      className={`flex scroll-mt-24 items-center gap-1.5 py-1.5 pr-3 pl-2 ${
        highlight ? "bg-bg rounded-2xl outline-2 outline-[var(--accent)]" : ""
      }`}
    >
      <div className="flex min-h-14 min-w-0 flex-1 items-center gap-2">
        <Link href={`/grocery/items/${item.id}`} className="flex min-w-0 items-start font-medium">
          <FoodEmoji name={item.name} />
          <span className="min-w-0 break-words">{item.name}</span>
        </Link>
      </div>
      <Link
        href={`/grocery/items/${item.id}#log-price`}
        aria-label={`Log a price for ${item.name}`}
        className="border-border flex min-h-12 shrink-0 items-center rounded-lg border px-2.5 text-[15px] font-medium"
      >
        Log
      </Link>
      <div className="w-[7rem] shrink-0 text-right text-[14px] leading-snug">
        {best ? (
          <>
            <p className="text-muted text-[12px] tracking-[0.1em] uppercase">Best</p>
            <p className="font-medium">
              {formatUnitPrice(best.unit_price_base, item.compare_unit)}
            </p>
            <p className="text-muted">
              {best.storeName} · {formatShortDate(best.observed_on, year)}
            </p>
          </>
        ) : (
          <p className="text-muted">No prices yet</p>
        )}
      </div>
    </li>
  );
}
