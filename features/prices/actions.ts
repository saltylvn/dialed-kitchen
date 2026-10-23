"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GENERIC_ERROR, userMessage, type ActionResult } from "@/lib/actionResult";
import { compareToBest, formatUnitPrice, type Comparison } from "@/lib/pricing";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";
import { pricePerBase, UNITS } from "@/lib/units";
import { itemFormSchema, itemRowSchema, PRICE_ERRORS, priceFormSchema } from "./schema";

// Price actions. Input is validated here; the database checks everything again (household,
// units, constraints) and is the final word.

const UNIQUE_VIOLATION = "23505";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form";
}

export type CreateItemResult = ActionResult | null;

export async function createItem(
  _prev: CreateItemResult,
  formData: FormData,
): Promise<CreateItemResult> {
  await requireUser();
  const parsed = itemFormSchema.safeParse({
    name: formData.get("name"),
    compareUnit: formData.get("compareUnit"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert({
      name: parsed.data.name,
      compare_unit: parsed.data.compareUnit,
      dimension: UNITS[parsed.data.compareUnit].dimension,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION)
      return { ok: false, error: `You already have "${parsed.data.name}"` };
    console.error("create item failed:", error.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/grocery");
  redirect(`/grocery/items/${data.id}`);
}

export type LogPriceResult = ActionResult<{
  comparison: Comparison;
  unitPrice: string;
  bestBefore: string | null;
}> | null;

// Saves a price and says how it compares to the best price found before it.
export async function logPrice(_prev: LogPriceResult, formData: FormData): Promise<LogPriceResult> {
  await requireUser();
  const parsed = priceFormSchema.safeParse({
    itemId: formData.get("itemId"),
    storeName: formData.get("storeName"),
    price: formData.get("price"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    onSale: formData.get("onSale") ?? undefined,
    observedOn: formData.get("observedOn"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const supabase = await createClient();

  // The item (for its display unit), the best earlier price, and the store, in parallel.
  const [item, best, storeId] = await Promise.all([
    supabase.from("items").select("compare_unit").eq("id", input.itemId).maybeSingle(),
    supabase
      .from("item_best_prices")
      .select("unit_price_base")
      .eq("item_id", input.itemId)
      .maybeSingle(),
    findOrCreateStore(supabase, input.storeName),
  ]);
  if (item.error || !item.data || best.error || !storeId) {
    console.error(
      "log price lookup failed:",
      item.error?.message ?? best.error?.message ?? "store",
    );
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase.from("item_prices").insert({
    item_id: input.itemId,
    store_id: storeId,
    price: input.price,
    package_quantity: input.quantity,
    package_unit: input.unit,
    on_sale: input.onSale,
    observed_on: input.observedOn,
  });
  if (error) {
    console.error("log price failed:", error.message);
    return { ok: false, error: userMessage(error, PRICE_ERRORS) };
  }

  const compareUnit = itemRowSchema.shape.compare_unit.parse(item.data.compare_unit);
  const unitPrice = pricePerBase(input.price, input.quantity, input.unit);
  const bestBefore = best.data ? Number(best.data.unit_price_base) : null;
  revalidatePath("/grocery");
  revalidatePath(`/grocery/items/${input.itemId}`);
  return {
    ok: true,
    data: {
      comparison: compareToBest(unitPrice, bestBefore),
      unitPrice: formatUnitPrice(unitPrice, compareUnit),
      bestBefore: bestBefore === null ? null : formatUnitPrice(bestBefore, compareUnit),
    },
  };
}

// Stores are matched by name, ignoring capitals ("aldi" is "Aldi"); new names are added.
async function findOrCreateStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeName: string,
): Promise<string | null> {
  const match = async () => {
    const { data } = await supabase.from("stores").select("id, name");
    return data?.find((s) => s.name.toLowerCase() === storeName.toLowerCase())?.id ?? null;
  };
  const existing = await match();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("stores")
    .insert({ name: storeName })
    .select("id")
    .single();
  if (!error) return data.id;
  // Your partner may have added the same store at the same moment: use theirs.
  if (error.code === UNIQUE_VIOLATION) return match();
  console.error("create store failed:", error.message);
  return null;
}

export async function deletePrice(formData: FormData): Promise<void> {
  await requireUser();
  const ids = z.object({ priceId: z.uuid(), itemId: z.uuid() }).safeParse({
    priceId: formData.get("priceId"),
    itemId: formData.get("itemId"),
  });
  if (!ids.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("item_prices").delete().eq("id", ids.data.priceId);
  if (error) console.error("delete price failed:", error.message);
  revalidatePath("/grocery");
  revalidatePath(`/grocery/items/${ids.data.itemId}`);
}

export async function deleteItem(formData: FormData): Promise<void> {
  await requireUser();
  const itemId = z.uuid().safeParse(formData.get("itemId"));
  if (!itemId.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", itemId.data);
  if (error) console.error("delete item failed:", error.message);
  revalidatePath("/grocery");
  redirect("/grocery");
}
