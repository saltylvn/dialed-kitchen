"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GENERIC_ERROR, userMessage, type ActionResult } from "@/lib/actionResult";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/db";
import { ateItSchema, dateSchema, goalSchema, quickAddSchema } from "./schema";

// Calorie-counting actions (docs/decisions/0051). The database works out the numbers and
// the household; these check the input and turn failures into friendly messages.

const FRIENDLY = [
  "Meal not found",
  "Portion must be",
  "Too many entries that day",
  "Enter the calories",
];
const OFFLINE = "Couldn't save that. Check your connection and try again.";

function failed(what: string, error: { message: string }, fallback = OFFLINE) {
  const message = userMessage(error, FRIENDLY);
  if (message === GENERIC_ERROR) {
    console.error(`${what} failed:`, error.message);
    return { ok: false as const, error: fallback };
  }
  return { ok: false as const, error: message };
}

// "Ate it": log a planned meal for me (null portion: my usual).
export async function ateIt(entryId: string, portion: number | null): Promise<ActionResult> {
  await requireUser();
  const parsed = ateItSchema.safeParse({ entryId, portion });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  const db = await createClient();
  const { error } = await db.rpc("log_planned_meal", {
    entry_id: parsed.data.entryId,
    portion: parsed.data.portion,
  });
  if (error) return failed("log_planned_meal", error);
  revalidatePath("/plan");
  return { ok: true, data: undefined };
}

// "Ate the plan": log every planned meal of the day I haven't logged yet.
export async function ateThePlan(date: string): Promise<ActionResult<{ logged: number }>> {
  await requireUser();
  if (!dateSchema.safeParse(date).success) return { ok: false, error: GENERIC_ERROR };
  const db = await createClient();
  const { data, error } = await db.rpc("log_day_as_planned", { day: date });
  if (error) return failed("log_day_as_planned", error);
  revalidatePath("/plan");
  return { ok: true, data: { logged: z.number().int().parse(data) } };
}

// Quick add: something that isn't a planned recipe.
export async function quickAdd(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = quickAddSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { date, meal, label, calories, protein } = parsed.data;
  const db = await createClient();
  const { error } = await db.rpc("log_quick", {
    day: date,
    meal,
    label,
    calories,
    protein_g: protein,
  });
  if (error) return failed("log_quick", error);
  revalidatePath("/plan");
  return { ok: true, data: undefined };
}

// Take something off my log (an Undo, or a mistake).
export async function unlog(id: string): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: GENERIC_ERROR };
  const db = await createClient();
  const { error } = await db.from("food_log").delete().eq("id", id);
  if (error) return failed("unlog", error);
  revalidatePath("/plan");
  return { ok: true, data: undefined };
}

// Set my daily goal.
export async function setGoal(calories: number, protein: number | null): Promise<ActionResult> {
  await requireUser();
  const parsed = goalSchema.safeParse({ calories, protein });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the goal" };
  const db = await createClient();
  const { error } = await db.rpc("set_my_goal", {
    calories: parsed.data.calories,
    protein_g: parsed.data.protein,
  });
  if (error) return failed("set_my_goal", error);
  revalidatePath("/plan");
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}
