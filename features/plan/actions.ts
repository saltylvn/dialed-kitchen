"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GENERIC_ERROR, userMessage, type ActionResult } from "@/lib/actionResult";
import { weekFromParam } from "@/lib/plan";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";
import { addToPlanSchema, type AddToPlanInput } from "./schema";

// Meal plan actions. The database (RLS, constraints) has the final word.

const FOREIGN_KEY_VIOLATION = "23503";

export async function addToPlan(input: AddToPlanInput): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = addToPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const { date, meal, recipeId, servings } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .insert({ plan_date: date, meal, recipe_id: recipeId, servings })
    .select("id")
    .single();
  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { ok: false, error: "That recipe was deleted. Pick another." };
    }
    const message = userMessage(error, ["Too many meals that day"]);
    if (message === GENERIC_ERROR) console.error("add to plan failed:", error.message);
    return { ok: false, error: message };
  }
  revalidatePath("/plan");
  revalidatePath("/recipes"); // "regulars" may have changed
  return { ok: true, data: { id: data.id } };
}

export async function removeFromPlan(id: string): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: GENERIC_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan_entries").delete().eq("id", id);
  if (error) {
    console.error("remove from plan failed:", error.message);
    return { ok: false, error: "Couldn't remove that. Check your connection and try again." };
  }
  revalidatePath("/plan");
  revalidatePath("/recipes");
  return { ok: true, data: undefined };
}

// Adds everything the week needs that isn't In stock or already on the list (one database
// step, add_week_to_list).
export async function addWeekToList(monday: string): Promise<ActionResult<{ added: number }>> {
  await requireUser();
  if (typeof monday !== "string" || weekFromParam(monday) !== monday) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_week_to_list", { week_start: monday });
  if (error) {
    console.error("add week to list failed:", error.message);
    return { ok: false, error: "Couldn't add to the list. Check your connection and try again." };
  }
  revalidatePath("/grocery", "layout");
  revalidatePath("/plan");
  return { ok: true, data: { added: z.number().int().parse(data) } };
}
