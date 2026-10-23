"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult } from "@/lib/actionResult";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";

// "In stock" actions. The database keeps In stock and the grocery list in step: marking
// something In stock takes it off the list in the same transaction (set_in_stock).

const nameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(200));

// Both tabs show In stock, so both refresh.
function refresh() {
  revalidatePath("/recipes");
  revalidatePath("/grocery", "layout");
}

export async function setInStock(name: string, inStock: boolean): Promise<void> {
  await requireUser();
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success || typeof inStock !== "boolean") return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_in_stock", { name: parsed.data, in_stock: inStock });
  if (error) {
    console.error("set in stock failed:", error.message);
    throw new Error("Couldn't save that. Check your connection and try again.");
  }
  refresh();
}

export type AddInStockResult = ActionResult<{ name: string }> | null;

// The In stock view's add form.
export async function addInStock(
  _prev: AddInStockResult,
  formData: FormData,
): Promise<AddInStockResult> {
  await requireUser();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { ok: false, error: "Type what's in your kitchen" };
  await setInStock(parsed.data, true);
  return { ok: true, data: { name: parsed.data } };
}

// After shopping: clears the bought (checked) entries and records them In stock.
export async function clearCheckedIntoStock(): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_checked_into_stock");
  if (error) console.error("clear checked failed:", error.message);
  refresh();
}
