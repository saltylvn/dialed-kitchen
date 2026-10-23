import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubPage } from "@/components/ui/SubPage";
import { deleteItem, deletePrice } from "@/features/prices/actions";
import { BestPriceLine, Tag } from "@/features/prices/components/BestPriceLine";
import { LogPriceForm } from "@/features/prices/components/LogPriceForm";
import { getItemPage } from "@/features/prices/queries";
import { compareUnitLabel } from "@/features/prices/schema";
import { formatShortDate, serverToday } from "@/lib/dates";
import { formatMoney, formatPackage, formatUnitPrice } from "@/lib/pricing";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Item · Dialed Kitchen" };

const card = "border-border bg-surface rounded-2xl border p-4";
const heading = "text-muted text-[12px] tracking-[0.2em] uppercase";

export default async function ItemPage({ params }: PageProps<"/grocery/items/[id]">) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const page = await getItemPage(id);
  if (!page) notFound();

  const { item, history, stores, bestPriceId } = page;
  const best = history.find((p) => p.id === bestPriceId);
  const year = Number(serverToday().slice(0, 4));

  return (
    <SubPage backHref="/grocery/prices" backLabel="Prices" title={item.name}>
      <div className="space-y-4">
        <section aria-labelledby="best-heading" className={card}>
          <h2 id="best-heading" className={heading}>
            Best price · {compareUnitLabel(item.compare_unit)}
          </h2>
          <p className="mt-2 text-[17px]">
            {best ? (
              <BestPriceLine
                unitPriceBase={best.unit_price_base}
                compareUnit={item.compare_unit}
                storeName={best.storeName}
                observedOn={best.observed_on}
                onSale={best.on_sale}
              />
            ) : (
              <span className="text-muted">No prices yet. Log one below.</span>
            )}
          </p>
        </section>

        <section aria-labelledby="log-heading" className={card}>
          <h2 id="log-heading" className={`${heading} mb-3`}>
            Log a price
          </h2>
          <LogPriceForm
            itemId={item.id}
            compareUnit={item.compare_unit}
            storeNames={stores.map((s) => s.name)}
          />
        </section>

        {history.length > 0 && (
          <section aria-labelledby="history-heading" className={card}>
            <h2 id="history-heading" className={heading}>
              History
            </h2>
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {history.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-medium">
                        {formatUnitPrice(p.unit_price_base, item.compare_unit)}
                      </span>
                      {p.id === bestPriceId && <Tag>✓ Best</Tag>}
                      {p.on_sale && <Tag>Sale</Tag>}
                    </p>
                    <p className="text-muted text-[15px]">
                      {formatMoney(p.price)} for {formatPackage(p.package_quantity, p.package_unit)}{" "}
                      · {p.storeName} · {formatShortDate(p.observed_on, year)}
                    </p>
                  </div>
                  <form action={deletePrice}>
                    <input type="hidden" name="priceId" value={p.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      aria-label={`Remove the ${formatMoney(p.price)} price from ${p.storeName}, ${formatShortDate(p.observed_on, year)}`}
                      className="text-muted flex size-12 items-center justify-center text-xl"
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <details className="px-1">
          <summary className="text-muted min-h-12 cursor-pointer content-center text-[15px]">
            Delete this item…
          </summary>
          <p className="mt-2 text-[15px]">
            Removes {item.name} and all {history.length} of its prices, for both of you.
          </p>
          <form action={deleteItem} className="mt-3">
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              className="border-border min-h-12 w-full rounded-xl border font-medium"
            >
              Delete {item.name}
            </button>
          </form>
        </details>
      </div>
    </SubPage>
  );
}
