import type { Metadata } from "next";
import Link from "next/link";
import { TabPage } from "@/components/ui/TabPage";
import { AddToListForm } from "@/features/list/components/AddToListForm";
import { GroceryList } from "@/features/list/components/GroceryList";
import { getListPage } from "@/features/list/queries";
import { StockList } from "@/features/stock/components/StockList";
import { listInStock } from "@/features/stock/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Grocery · Dialed Kitchen" };

const part = "font-display text-[28px] leading-tight font-light italic";

// The three ways into prices, as rows (docs/decisions/0035).
const PRICE_LINKS = [
  { href: "/grocery/prices", label: "Price book", hint: "Every item's best price and store" },
  { href: "/grocery/receipt", label: "Scan a receipt", hint: "Log a whole trip with the camera" },
  { href: "/grocery/log", label: "Log a price", hint: "One item at any store" },
] as const;

// The Grocery tab (docs/decisions/0035): the price rows, then the Grocery list (with its add
// box at the end), then what's In stock. Ticking an item on the list moves it In stock, so
// what you need and what you have are together. Prices live in the Price book, one tap from
// each item. All reads run in parallel.
export default async function GroceryPage() {
  const [, page, inStock] = await Promise.all([requireUser(), getListPage(), listInStock()]);

  return (
    <TabPage tab="grocery">
      <nav aria-label="Prices">
        <ul className="border-border bg-surface divide-y divide-[var(--border)] rounded-2xl border">
          {PRICE_LINKS.map(({ href, label, hint }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="text-muted block text-[15px]">{hint}</span>
                </span>
                <span aria-hidden className="text-muted text-xl">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        <GroceryList entries={page.entries}>
          <AddToListForm itemNames={page.itemNames} />
        </GroceryList>
      </div>

      <section id="in-stock" aria-labelledby="stock-heading" className="mt-10 scroll-mt-4">
        <h2 id="stock-heading" className={`${part} mb-4`}>
          In stock
        </h2>
        <StockList items={inStock} />
      </section>
    </TabPage>
  );
}
