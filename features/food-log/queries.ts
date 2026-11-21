import "server-only";
import { z } from "zod";
import { addDays } from "@/lib/dates";
import type { Goal, LogEntry } from "@/lib/foodLog";
import { createClient } from "@/lib/server/db";
import { goalRowSchema, logRowSchema } from "./schema";

// Reads for calorie counting (server-only, validated). Row-level security returns only the
// signed-in person's own log and goal, never their partner's.

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

// What I logged in the week starting on `monday`.
export async function getMyWeekLog(monday: string): Promise<LogEntry[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("food_log")
    .select("id, log_date, meal, plan_entry_id, label, portion, calories, protein_g")
    .gte("log_date", monday)
    .lte("log_date", addDays(monday, 6))
    .order("created_at");
  if (error) fail("food_log", error);
  return z
    .array(logRowSchema)
    .parse(data)
    .map((r) => ({
      id: r.id,
      logDate: r.log_date,
      meal: r.meal,
      planEntryId: r.plan_entry_id,
      label: r.label,
      portion: r.portion,
      calories: r.calories,
      protein: r.protein_g,
    }));
}

// My daily goal, or null when I haven't set one.
export async function getMyGoal(): Promise<Goal | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("nutrition_goals")
    .select("calories, protein_g")
    .maybeSingle();
  if (error) fail("nutrition_goals", error);
  if (!data) return null;
  const row = goalRowSchema.parse(data);
  return { calories: row.calories, protein: row.protein_g };
}
