import { z } from "zod";
import { addDays, isIsoDate, serverToday } from "@/lib/dates";
import { isUnit, UNITS, type Unit } from "@/lib/units";

// What valid input looks like, and the shape of rows read back from the database.
// Everything from a form or the database is checked here before the app uses it.

const unit = z
  .string()
  .refine(isUnit, "Choose a unit")
  .transform((u) => u as Unit);

// "$3.49", "3.49", "1,299.00" → 3.49 / 1299. Up to 2 decimal places.
export function parseMoney(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(cleaned)) return null;
  return Number(cleaned);
}

// "2", "1.5", ".75" → a positive number with up to 3 decimal places.
export function parseQuantity(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim();
  if (!/^\d+(\.\d{1,3})?$|^\.\d{1,3}$/.test(cleaned)) return null;
  return Number(cleaned);
}

const name = (max: number, label: string) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z.string().min(1, `Enter a ${label}`).max(max, `Keep the ${label} under ${max} characters`),
    );

export const itemFormSchema = z.object({
  name: name(80, "name"),
  compareUnit: unit,
});

export const priceFormSchema = z.object({
  itemId: z.uuid(),
  storeId: z.uuid({ message: "Choose a store" }),
  price: z.string().transform((s, ctx) => {
    const value = parseMoney(s);
    if (value === null || value <= 0 || value >= 100000) {
      ctx.addIssue({ code: "custom", message: "Enter the price, like 3.49" });
      return z.NEVER;
    }
    return value;
  }),
  quantity: z.string().transform((s, ctx) => {
    const value = parseQuantity(s);
    if (value === null || value <= 0 || value >= 1000000) {
      ctx.addIssue({ code: "custom", message: "Enter the package size, like 2 or 1.5" });
      return z.NEVER;
    }
    return value;
  }),
  unit,
  onSale: z.literal("on").optional().transform(Boolean),
  // The shopper's local date. Allow a day of slack around the server's date (time zones),
  // but nothing in the future beyond that and nothing absurdly old.
  observedOn: z
    .string()
    .refine(isIsoDate, "Choose a date")
    .refine((d) => d <= addDays(serverToday(), 1), "That date is in the future")
    .refine((d) => d >= "2000-01-01", "Choose a more recent date"),
});

// ─── Rows read from the database ──────────────────────────────────────────────

export const itemRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  compare_unit: unit,
});
export type ItemRow = z.infer<typeof itemRowSchema>;

// Stores are a fixed list of six (docs/decisions/0012), shown in sort_order.
export const storeRowSchema = z.object({ id: z.uuid(), name: z.string() });
export type StoreRow = z.infer<typeof storeRowSchema>;

export const priceRowSchema = z.object({
  id: z.uuid(),
  item_id: z.uuid(),
  store_id: z.uuid(),
  price: z.coerce.number(),
  package_quantity: z.coerce.number(),
  package_unit: unit,
  on_sale: z.boolean(),
  observed_on: z.string(),
  unit_price_base: z.coerce.number(),
});
export type PriceRow = z.infer<typeof priceRowSchema>;

export const bestPriceRowSchema = priceRowSchema.omit({ id: true }).extend({ price_id: z.uuid() });
export type BestPriceRow = z.infer<typeof bestPriceRowSchema>;

// Our own messages from the database, safe to show as-is (lib/actionResult).
export const PRICE_ERRORS = [
  "That unit doesn't fit this item",
  "This item already has prices in other units",
] as const;

// "per lb", "per fl oz", "each": how an item's prices are shown.
export function compareUnitLabel(u: Unit): string {
  return u === "each" ? "each" : `per ${UNITS[u].label}`;
}
