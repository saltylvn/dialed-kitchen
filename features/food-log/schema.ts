import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { MEAL_IDS } from "@/lib/plan";

// Valid input for calorie counting (docs/decisions/0051), and rows read back.

export const portionSchema = z.coerce
  .number()
  .min(0.25, "Portion must be ½ to 10")
  .max(10, "Portion must be ½ to 10");

export const ateItSchema = z.object({
  entryId: z.uuid(),
  portion: portionSchema.nullable(), // null: your usual portion
});

export const dateSchema = z.string().refine(isIsoDate, "Choose a day");

export const quickAddSchema = z.object({
  date: dateSchema,
  meal: z.enum(MEAL_IDS, "Choose a meal"),
  label: z.string().trim().min(1, "Name what you ate").max(80, "Keep the name under 80 letters"),
  calories: z.coerce
    .number("Enter the calories")
    .int("Calories are a whole number")
    .min(0, "Calories must be 0 to 20,000")
    .max(20000, "Calories must be 0 to 20,000"),
  protein: z
    .union([z.literal("").transform(() => null), z.coerce.number().min(0).max(2000)])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export const goalSchema = z.object({
  calories: z.coerce
    .number()
    .int()
    .min(500, "Goal must be 500 to 10,000")
    .max(10000, "Goal must be 500 to 10,000"),
  protein: z.coerce.number().int().min(0).max(1000).nullable(),
});

export const logRowSchema = z.object({
  id: z.uuid(),
  log_date: z.string(),
  meal: z.enum(MEAL_IDS),
  plan_entry_id: z.uuid().nullable(),
  label: z.string(),
  portion: z.coerce.number(),
  calories: z.number().int().nullable(),
  protein_g: z.coerce.number().nullable(),
});

export const goalRowSchema = z.object({
  calories: z.number().int(),
  protein_g: z.number().int().nullable(),
});
