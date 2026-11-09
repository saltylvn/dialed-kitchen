"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GENERIC_ERROR, type ActionResult } from "@/lib/actionResult";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";
import { addToListSchema } from "./schema";

// Grocery list actions. The database (RLS, constraints) has the final word.

const UNIQUE_VIOLATION = "23505";

export type AddToListResult = ActionResult<{ name: string }> | null;

// Adds something to the list. If it matches a price-book item by name (ignoring capitals),
// it's linked, so the list shows its best price and store prices.
export async function addToList(
  _prev: AddToListResult,
  formData: FormData,
): Promise<AddToListResult> {
  await requireUser();
  const parsed = addToListSchema.safeParse({
    name: formData.get("name"),
    quantity: formData.get("quantity") ?? undefined,
    unit: formData.get("unit") ?? undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { name, quantity, unit } = parsed.data;
  if (unit && quantity === null) return { ok: false, error: "Add an amount for that unit" };

  const supabase = await createClient();
  const { data: items } = await supabase.from("items").select("id, name");
  const match = items?.find((i) => i.name.toLowerCase() === name.toLowerCase());

  const { error } = await supabase.from("grocery_list_items").insert({
    name: match?.name ?? name,
    item_id: match?.id ?? null,
    quantity,
    unit,
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION)
      return { ok: false, error: `${match?.name ?? name} is already on the list` };
    console.error("add to list failed:", error.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  revalidatePath("/grocery", "layout");
  return { ok: true, data: { name: match?.name ?? name } };
}

const idSchema = z.uuid();

// Check or uncheck one entry. Called with the new state, so a double tap can't flip it twice.
export async function setChecked(id: string, checked: boolean): Promise<void> {
  await requireUser();
  if (!idSchema.safeParse(id).success || typeof checked !== "boolean") return;
  const supabase = await createClient();
  const { error } = await supabase.from("grocery_list_items").update({ checked }).eq("id", id);
  if (error) {
    console.error("set checked failed:", error.message);
    throw new Error("Couldn't save that. Check your connection and try again.");
  }
  revalidatePath("/grocery", "layout");
}

export async function removeFromList(id: string): Promise<void> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("grocery_list_items").delete().eq("id", id);
  if (error) {
    console.error("remove from list failed:", error.message);
    throw new Error("Couldn't remove that. Check your connection and try again.");
  }
  revalidatePath("/grocery", "layout");
}
