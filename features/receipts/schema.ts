import { z } from "zod";
import { itemFormSchema, priceFormSchema } from "@/features/prices/schema";
import { receiptKey } from "@/lib/receipt";
import type { Unit } from "@/lib/units";

// The shape of a reviewed receipt the person saves (docs/decisions/0033). Each line goes to
// an existing price-book item or makes a new one; price, size, unit and date follow the same
// rules as the item page's price form (priceFormSchema), so a receipt can't save anything a
// typed price couldn't.

const lineSchema = z
  .object({
    receiptText: z.string().max(200).transform(receiptKey), // "" = nothing to remember
    itemId: z.uuid().nullable(),
    newItemName: itemFormSchema.shape.name.nullable(),
    price: priceFormSchema.shape.price,
    quantity: priceFormSchema.shape.quantity,
    unit: priceFormSchema.shape.unit,
    onSale: z.boolean(),
  })
  .refine((l) => (l.itemId === null) !== (l.newItemName === null), {
    message: "Choose an item for each line",
  });

export const saveReceiptSchema = z.object({
  storeId: z.uuid({ message: "Choose the store" }),
  observedOn: priceFormSchema.shape.observedOn,
  lines: z.array(lineSchema).min(1, "Choose at least one line to save").max(100),
});

export type SaveReceiptInput = z.input<typeof saveReceiptSchema>;

// One line of the review screen, as the scan hands it over.
export type ReceiptDraftLine = {
  text: string;
  name: string;
  price: number;
  quantity: number;
  unit: Unit;
  onSale: boolean;
  suggestedItemId: string | null;
  remembered: boolean; // matched from an earlier receipt at this store
};

export type ReceiptDraft = {
  storeId: string | null; // recognized from the receipt, else null
  date: string | null;
  lines: ReceiptDraftLine[];
};
