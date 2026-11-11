import Link from "next/link";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { serverToday } from "@/lib/dates";
import { formatUnitAmount, isOlder } from "@/lib/pricing";
import { UNITS } from "@/lib/units";
import type { ItemWithStorePrices } from "../queries";

// One row of the price book, comparing stores (docs/decisions/0044): the item and its unit
// on top (tap it for the full history and chart), Log on the right, and below, each store's
// latest price as a chip, cheapest first. The cheapest is marked with ✓, an orange outline
// and the word "cheapest" for screen readers (never color alone); Sale and Older are spelled
// out. A link to ?item=<id>#item-<id> scrolls to the row and outlines it.
export function PriceBookRow({
  item,
  highlight = false,
}: {
  item: ItemWithStorePrices;
  highlight?: boolean;
}) {
  const today = serverToday();
  const unit = item.compare_unit === "each" ? "each" : `per ${UNITS[item.compare_unit].label}`;

  return (
    <li
      id={`item-${item.id}`}
      aria-current={highlight ? "true" : undefined}
      className={`scroll-mt-24 px-3 py-2 ${
        highlight ? "bg-bg rounded-2xl outline-2 outline-[var(--accent)]" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Link
          href={`/grocery/items/${item.id}`}
          className="flex min-h-12 min-w-0 flex-1 items-center font-medium"
        >
          <FoodEmoji name={item.name} />
          <span className="min-w-0 break-words">
            {item.name}
            <span className="text-muted font-normal"> · {unit}</span>
          </span>
        </Link>
        <Link
          href={`/grocery/items/${item.id}#log-price`}
          aria-label={`Log a price for ${item.name}`}
          className="border-border flex min-h-12 shrink-0 items-center rounded-lg border px-3 text-[15px] font-medium"
        >
          Log
        </Link>
      </div>

      {item.stores.length === 0 ? (
        <p className="text-muted pb-1 text-[15px]">No prices yet</p>
      ) : (
        <ul aria-label={`${item.name} prices by store`} className="flex flex-wrap gap-1.5 pb-1">
          {item.stores.map((s) => (
            <li
              key={s.storeId}
              className={`rounded-lg px-2 py-1 text-[15px] leading-snug ${
                s.cheapest ? "border-2 border-[var(--accent)]" : "border-border text-muted border"
              }`}
            >
              {s.cheapest && (
                <>
                  <span aria-hidden>✓ </span>
                  <span className="sr-only">Cheapest: </span>
                </>
              )}
              {s.storeName}{" "}
              <span className={s.cheapest ? "font-medium" : "text-text"}>
                {formatUnitAmount(s.latest.unit_price_base, item.compare_unit)}
              </span>
              {s.latest.on_sale && <span className="text-muted"> · sale</span>}
              {isOlder(s.latest.observed_on, today) && <span className="text-muted"> · older</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
