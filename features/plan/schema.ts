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
});
export type PlanEntryRow = z.infer<typeof planEntryRowSchema>;
