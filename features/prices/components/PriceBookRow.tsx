import Link from "next/link";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { formatShortDate, serverToday } from "@/lib/dates";
import { foodEmoji } from "@/lib/foodEmoji";
import { formatUnitAmount } from "@/lib/pricing";
import type { ItemWithBest } from "../queries";
import { compareUnitLabel } from "../schema";
import { Tag } from "./BestPriceLine";

// One row of the Price Tracker: the food (emoji or photo on the left, name, amount on the
// list), a box with the household's main stores and their prices, and a Log price button.
// An item not in the price book yet logs its first price by adding it (name filled in).
// An item with no emoji (custom or recognized from the name) gets a spot to choose one.
export function PriceBookRow({
  name,
  item,
  amount,
  checked,
}: {
  name: string;
  item: ItemWithBest | null;
  amount?: string;
  checked?: boolean;
}) {
  const logHref = item
    ? `/grocery/items/${item.id}#log-price`
    : `/grocery/items/new?name=${encodeURIComponent(name)}`;

  return (
    <li className="flex gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        {item ? (
          <div className="flex items-center gap-2">
            {!item.photo && !item.emoji && !foodEmoji(name) && (
              // No photo or emoji for this item: a spot to choose one.
              <Link
                href={`/grocery/items/${item.id}#emoji`}
                aria-label={`Choose an emoji for ${name}`}
                className="border-border text-muted flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed text-xl"
              >
                ＋
              </Link>
            )}
            <Link
              href={`/grocery/items/${item.id}`}
              className="block min-h-6 min-w-0 font-medium break-words"
            >
              <FoodEmoji name={name} custom={item.emoji} photo={item.photo} />
              {name}
            </Link>
          </div>
        ) : (
          <p className="font-medium break-words">
            <FoodEmoji name={name} />
            {name}
          </p>
        )}
        {(amount || checked) && (
          <p className="text-muted text-[15px]">
            {amount}
            {checked && <Tag>✓ Checked</Tag>}
          </p>
        )}
        <Link
          href={logHref}
          aria-label={`Log a price for ${name}`}
          className="border-border mt-2 inline-flex min-h-12 items-center rounded-xl border px-4 font-medium"
        >
          Log price
        </Link>
      </div>
      <StoresBox item={item} />
    </li>
  );
}

// The household's main stores with the price last logged at each, cheapest first (✓).
// If the best price ever found beats all three (often another store), it's added below.
function StoresBox({ item }: { item: ItemWithBest | null }) {
  const unit = item?.compare_unit;
  const cheapest = item?.mainStores[0]?.unitPrice ?? null;
  const best = item?.best;
  const showBest = best && (cheapest === null || best.unit_price_base < cheapest);
  const year = Number(serverToday().slice(0, 4));

  return (
    <div className="border-border bg-bg w-44 shrink-0 self-start rounded-xl border p-2.5">
      <p className="text-muted text-[11px] tracking-[0.15em] uppercase">
        Your stores{unit && ` · ${compareUnitLabel(unit)}`}
      </p>
      {item && unit ? (
        <ul className="mt-1 space-y-0.5 text-[15px]">
          {item.mainStores.map((s, i) => {
            const isCheapest = i === 0 && s.unitPrice !== null;
            return (
              <li key={s.storeName} className="flex items-baseline gap-2">
                <span className={`min-w-0 flex-1 break-words ${isCheapest ? "font-medium" : ""}`}>
                  {isCheapest && <span aria-hidden>✓ </span>}
                  {s.storeName}
                  {isCheapest && <span className="sr-only"> (cheapest)</span>}
                </span>
                {s.unitPrice === null ? (
                  <span className="text-muted">
                    <span aria-hidden>—</span>
                    <span className="sr-only">no price yet</span>
                  </span>
                ) : (
                  <span className={isCheapest ? "font-medium" : ""}>
                    {formatUnitAmount(s.unitPrice, unit)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted mt-0.5 text-[15px]">No price yet</p>
      )}
      {item && unit && best && showBest && (
        <p className="border-border mt-1.5 border-t pt-1.5 text-[13px]">
          <span className="text-muted">Best </span>
          <span className="font-medium">{formatUnitAmount(best.unit_price_base, unit)}</span>
          <span className="text-muted">
            {" "}
            · {best.storeName} · {formatShortDate(best.observed_on, year)}
          </span>
        </p>
      )}
    </div>
  );
}
