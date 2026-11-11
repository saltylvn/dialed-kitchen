import Link from "next/link";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { serverToday } from "@/lib/dates";
import { formatUnitAmount, isOlder } from "@/lib/pricing";
import { UNITS } from "@/lib/units";
import type { ItemWithStorePrices } from "../queries";

// One row of the price book, comparing stores (docs/decisions/0044): on the left the item
// (tap it for the full history and chart), its unit and Log price; on the right, each
// store's latest price as a small chip, cheapest first. The cheapest is marked with ✓, an orange outline
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
      <div className="flex items-start gap-3">
        {/* Left: the item (tap for history and chart), its unit, and Log price. */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/grocery/items/${item.id}`}
            className="flex min-h-12 items-center font-medium"
          >
            <FoodEmoji name={item.name} />
            <span className="min-w-0 break-words">{item.name}</span>
          </Link>
          <p className="text-muted -mt-2 flex items-center gap-1.5 text-[14px]">
            {unit} ·
            <Link
              href={`/grocery/items/${item.id}#log-price`}
              aria-label={`Log a price for ${item.name}`}
              className="inline-flex min-h-12 items-center underline"
            >
              Log price
            </Link>
          </p>
        </div>

        {/* Right: each store's latest price as a small chip, cheapest first. */}
        {item.stores.length === 0 ? (
          <p className="text-muted shrink-0 pt-3 text-[14px]">No prices yet</p>
        ) : (
          <ul
            aria-label={`${item.name} prices by store`}
            className="flex shrink-0 flex-col items-end gap-1 pt-2.5"
          >
            {item.stores.map((s) => (
              <li
                key={s.storeId}
                className={`rounded-md px-1.5 py-0.5 text-[13px] leading-snug ${
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
                {isOlder(s.latest.observed_on, today) && (
                  <span className="text-muted"> · older</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
