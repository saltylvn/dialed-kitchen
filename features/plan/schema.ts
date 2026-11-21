import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { MEAL_IDS } from "@/lib/plan";

// Valid input for the meal plan, and plan rows read back.

export const addToPlanSchema = z.object({
  date: z.string().refine(isIsoDate, "Choose a day"),
  meal: z.enum(MEAL_IDS, "Choose a meal"),
  recipeId: z.uuid("Choose a recipe"),
  servings: z.coerce
    .number()
    .int()
    .min(1, "Servings must be 1 to 50")
    .max(50, "Servings must be 1 to 50"),
});
export type AddToPlanInput = z.input<typeof addToPlanSchema>;

export const planEntryRowSchema = z.object({
  id: z.uuid(),
  plan_date: z.string(),
  meal: z.enum(MEAL_IDS),
  recipe_id: z.uuid(),
  servings: z.number().int(),
  leftover_of: z.uuid().nullable(), // leftovers of another planned meal (decision 0053)
});
export type PlanEntryRow = z.infer<typeof planEntryRowSchema>;

export const leftoversSchema = z.object({
  source: z.uuid(),
  date: z.string().refine(isIsoDate, "Choose a day"),
  meal: z.enum(MEAL_IDS, "Choose a meal"),
  servings: z.coerce
    .number()
    .int()
    .min(1, "Servings must be 1 to 50")
    .max(50, "Servings must be 1 to 50"),
});

// Whole or cents dollars, up to $10,000 a week; null clears it.
export const budgetSchema = z
  .number()
  .positive("The budget must be more than $0")
  .max(10000, "The budget must be $10,000 or less")
  .nullable();
