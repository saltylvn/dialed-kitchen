import type { Metadata } from "next";
import { SubPage } from "@/components/ui/SubPage";
import { ReceiptScanner } from "@/features/receipts/components/ReceiptScanner";
import { getReceiptPage } from "@/features/receipts/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Scan a receipt · Dialed Kitchen" };

// Reading a receipt with AI can take a while on the free tier (lib/server/gemini.ts).
export const maxDuration = 60;

// Scan a receipt to log a whole trip's prices at once (docs/decisions/0033).
export default async function ReceiptPage() {
  const [, { items, stores }] = await Promise.all([requireUser(), getReceiptPage()]);
  return (
    <SubPage backHref="/grocery" backLabel="Grocery" title="Scan a receipt">
      <ReceiptScanner items={items} stores={stores} />
    </SubPage>
  );
}
