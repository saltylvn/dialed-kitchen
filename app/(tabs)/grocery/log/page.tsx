import type { Metadata } from "next";
import { SubPage } from "@/components/ui/SubPage";
import { LogPriceChooser } from "@/features/prices/components/LogPriceChooser";
import { getLogPricePage } from "@/features/prices/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Log a price · Dialed Kitchen" };

// Log a price for any item in the price book (docs/decisions/0035). ?item= picks the item
// to start with; it's only used if it's one of yours.
export default async function LogPricePage({ searchParams }: PageProps<"/grocery/log">) {
  const [, { item }, page] = await Promise.all([requireUser(), searchParams, getLogPricePage()]);
  const start = page.items.find((i) => i.id === item)?.id ?? null;
  return (
    <SubPage backHref="/grocery" backLabel="Grocery" title="Log a price">
      <LogPriceChooser items={page.items} stores={page.stores} initialItemId={start} />
    </SubPage>
  );
}
