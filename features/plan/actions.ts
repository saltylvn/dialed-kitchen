"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GENERIC_ERROR, userMessage, type ActionResult } from "@/lib/actionResult";
import { weekFromParam } from "@/lib/plan";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/db";
import { addToPlanSchema, budgetSchema, leftoversSchema, type AddToPlanInput } from "./schema";

// Meal plan actions. The database (RLS, constraints) has the final word.

const FOREIGN_KEY_VIOLATION = "23503";

export async function addToPlan(input: AddToPlanInput): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = addToPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const { date, meal, recipeId, servings } = parsed.data;

  const db = await createClient();
  const { data, error } = await db
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
  const db = await createClient();
  const { error } = await db.from("meal_plan_entries").delete().eq("id", id);
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
  const db = await createClient();
  const { data, error } = await db.rpc("add_week_to_list", { week_start: monday });
  if (error) {
    console.error("add week to list failed:", error.message);
    return { ok: false, error: "Couldn't add to the list. Check your connection and try again." };
  }
  revalidatePath("/grocery", "layout");
  revalidatePath("/plan");
  return { ok: true, data: { added: z.number().int().parse(data) } };
}

// Repeat a week: copy every meal planned in `fromWeek` into `toWeek` (both Mondays), skipping
// what's already there (copy_plan_week, decision 0053).
export async function copyPlanWeek(
  fromWeek: string,
  toWeek: string,
): Promise<ActionResult<{ added: number }>> {
  await requireUser();
  if (weekFromParam(fromWeek) !== fromWeek || weekFromParam(toWeek) !== toWeek) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const db = await createClient();
  const { data, error } = await db.rpc("copy_plan_week", { from_week: fromWeek, to_week: toWeek });
  if (error) {
    const message = userMessage(error, ["Too many meals that day"]);
    if (message === GENERIC_ERROR) console.error("copy plan week failed:", error.message);
    return { ok: false, error: message };
  }
  revalidatePath("/plan");
  revalidatePath("/recipes");
  return { ok: true, data: { added: z.number().int().parse(data) } };
}

// Plan leftovers of a planned meal on a later day (plan_leftovers, decision 0053).
export async function planLeftovers(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = leftoversSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const { source, date, meal, servings } = parsed.data;
  const db = await createClient();
  const { data, error } = await db.rpc("plan_leftovers", { source, day: date, meal, servings });
  if (error) {
    const message = userMessage(error, [
      "Meal not found",
      "Leftovers must be within a week after the meal",
      "Too many meals that day",
    ]);
    if (message === GENERIC_ERROR) console.error("plan leftovers failed:", error.message);
    return { ok: false, error: message };
  }
  revalidatePath("/plan");
  return { ok: true, data: { id: z.uuid().parse(data) } };
}

// The household's weekly grocery budget, or none (null).
export async function setWeeklyBudget(amount: number | null): Promise<ActionResult> {
  await requireUser();
  const parsed = budgetSchema.safeParse(amount);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the budget" };
  }
  const db = await createClient();
  const { error } = await db.rpc("set_weekly_budget", { amount: parsed.data });
  if (error) {
    console.error("set weekly budget failed:", error.message);
    return { ok: false, error: "Couldn't save the budget. Check your connection and try again." };
  }
  revalidatePath("/plan");
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}
