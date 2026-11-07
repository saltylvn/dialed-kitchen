import Link from "next/link";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { formatShortDate, serverToday } from "@/lib/dates";
import { formatUnitPrice, isOlder } from "@/lib/pricing";
import type { ItemWithBest } from "../queries";
import { Tag } from "./BestPriceLine";

// One row of the Prices view: the food (emoji on the left, name, amount on the list), a
// "Best price" box with the store it was found at, and a Log price button.
// An item not in the price book yet logs its first price by adding it (name filled in).
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
          <Link
            href={`/grocery/items/${item.id}`}
            className="block min-h-6 font-medium break-words"
          >
            <FoodEmoji name={name} />
            {name}
          </Link>
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
      <BestPriceBox item={item} />
    </li>
  );
}

function BestPriceBox({ item }: { item: ItemWithBest | null }) {
  const best = item?.best;
  const today = serverToday();
  return (
    <div className="border-border bg-bg w-36 shrink-0 self-start rounded-xl border p-2.5">
      <p className="text-muted text-[11px] tracking-[0.15em] uppercase">Best price</p>
      {item && best ? (
        <>
          <p className="mt-0.5 text-[17px] font-medium">
            {formatUnitPrice(best.unit_price_base, item.compare_unit)}
          </p>
          <p className="text-[15px] break-words">{best.storeName}</p>
          <p className="text-muted text-[13px]">
            {formatShortDate(best.observed_on, Number(today.slice(0, 4)))}
          </p>
          {(best.on_sale || isOlder(best.observed_on, today)) && (
            <p className="-ml-2 leading-6">
              {best.on_sale && <Tag>Sale</Tag>}
              {isOlder(best.observed_on, today) && <Tag>Older</Tag>}
            </p>
          )}
        </>
      ) : (
        <p className="text-muted mt-0.5 text-[15px]">No price yet</p>
      )}
    </div>
  );
}
