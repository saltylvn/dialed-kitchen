import Link from "next/link";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { foodEmoji } from "@/lib/foodEmoji";
import type { ItemWithBest } from "../queries";
import { compareUnitLabel } from "../schema";
import { StorePrices } from "./StorePrices";

// One row of the price book, laid out like the grocery rows (docs/decisions/0034): the item
// on the left (tap it for its page and history), Log in the middle, your stores' last prices
// on the right. An item with no emoji or photo gets a ＋ spot to choose one.
export function PriceBookRow({ item }: { item: ItemWithBest }) {
  return (
    <li className="flex items-center gap-1.5 py-1.5 pr-2 pl-2">
      <div className="flex min-h-14 min-w-0 flex-1 items-center gap-2">
        {!item.photo && !item.emoji && !foodEmoji(item.name) && (
          // No photo or emoji for this item: a spot to choose one.
          <Link
            href={`/grocery/items/${item.id}#emoji`}
            aria-label={`Choose an emoji or photo for ${item.name}`}
            className="border-border text-muted flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed text-xl"
          >
            ＋
          </Link>
        )}
        <Link href={`/grocery/items/${item.id}`} className="flex min-w-0 items-start font-medium">
          <FoodEmoji name={item.name} custom={item.emoji} photo={item.photo} />
          <span className="min-w-0 break-words">{item.name}</span>
        </Link>
      </div>
      <Link
        href={`/grocery/items/${item.id}#log-price`}
        aria-label={`Log a price for ${item.name}`}
        className="border-border flex min-h-12 shrink-0 items-center rounded-lg border px-2 text-[15px] font-medium"
      >
        Log
      </Link>
      <StorePrices stores={item.stores} unitLabel={compareUnitLabel(item.compare_unit)} />
    </li>
  );
}
