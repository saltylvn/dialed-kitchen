import { z } from "zod";
import { parseIngredientLines, type ParsedIngredient } from "@/lib/ingredients";
import { MAX_CALORIES, MAX_GRAMS, type Nutrition } from "@/lib/nutrition";
import { MEAL_IDS, type MealId } from "@/lib/plan";
import { isUnit, type Unit } from "@/lib/units";

// Valid recipe input, and recipe rows read back from the database.

export const SOURCE_TYPES = {
  own: "Our own",
  website: "Website",
  cookbook: "Cookbook",
  magazine: "Magazine",
  other: "Other",
} as const;
export type SourceType = keyof typeof SOURCE_TYPES;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((s) => s?.trim().replace(/\s+/g, " ") || null)
    .pipe(z.string().max(max, `Keep the ${label} under ${max} characters`).nullable());

// An optional number typed in a nutrition box: "" → null, "12.5" → 12.5.
const nutritionValue = (max: number, label: string, decimals: number) =>
  z
    .string()
    .optional()
    .transform((s, ctx) => {
      const text = s?.trim().replace(/,/g, "");
      if (!text) return null;
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be 0 to ${max}, or empty` });
        return z.NEVER;
      }
      return Math.round(n * 10 ** decimals) / 10 ** decimals;
    });

export const recipeFormSchema = z.object({
  recipeId: z.uuid().nullable(),
  title: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z.string().min(1, "Give the recipe a name").max(120, "Keep the name under 120 characters"),
    ),
  servings: z.coerce
    .number()
    .int()
    .min(1, "Servings must be 1 to 50")
    .max(50, "Servings must be 1 to 50"),
  sourceType: z.enum(Object.keys(SOURCE_TYPES) as [SourceType, ...SourceType[]]),
  sourceName: optionalText(120, "source name"),
  sourceUrl: z
    .string()
    .optional()
    .transform((s) => s?.trim() || null)
    .pipe(
      z
        .url({ protocol: /^https$/, message: "Use a full https:// web address, or leave it empty" })
        .max(2000)
        .nullable(),
    ),
  // One ingredient per line, read by lib/ingredients ("2 cups flour").
  ingredients: z
    .string()
    .transform((s) => parseIngredientLines(s))
    .pipe(
      z
        .array(z.custom<ParsedIngredient>())
        .max(200, "Keep it under 200 ingredients")
        .refine(
          (list) => list.every((i) => i.name.length <= 200),
          "Keep each ingredient under 200 characters",
        ),
    ),
  // Which meals it's for (any of the four, or none yet).
  meals: z.array(z.enum(MEAL_IDS)).max(4),
  // Per serving, all optional (lib/nutrition).
  calories: nutritionValue(MAX_CALORIES, "Calories", 0),
  protein: nutritionValue(MAX_GRAMS, "Protein", 1),
  carbs: nutritionValue(MAX_GRAMS, "Carbs", 1),
  fat: nutritionValue(MAX_GRAMS, "Fat", 1),
  // One step per line.
  steps: z
    .string()
    .transform((s) =>
      s
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^\d+[.)]\s*/, "")) // drop typed "1." numbering
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(2000, "Keep each step under 2000 characters"))
        .max(100, "Keep it under 100 steps"),
    ),
});
export type RecipeInput = z.infer<typeof recipeFormSchema>;

const unit = z
  .string()
  .nullable()
  .refine((u) => u === null || isUnit(u))
  .transform((u) => u as Unit | null);

export const recipeRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  servings: z.number().int(),
  source_type: z.enum(Object.keys(SOURCE_TYPES) as [SourceType, ...SourceType[]]),
  source_name: z.string().nullable(),
  source_url: z.string().nullable(),
  steps: z.array(z.string()),
  favorite: z.boolean(),
  calories: z.number().int().nullable(),
  protein_g: z.coerce.number().nullable(),
  carbs_g: z.coerce.number().nullable(),
  fat_g: z.coerce.number().nullable(),
  meals: z.array(z.enum(MEAL_IDS)),
});
export type RecipeRow = z.infer<typeof recipeRowSchema>;

export const ingredientRowSchema = z.object({
  recipe_id: z.uuid(),
  sort_order: z.number().int(),
  quantity: z.coerce.number().nullable(),
  unit,
  name: z.string(),
  item_id: z.uuid().nullable(),
});
export type IngredientRow = z.infer<typeof ingredientRowSchema>;

// What the recipe form starts from: an existing recipe (id set) or a new draft (an import).
export type RecipeDraft = {
  id?: string;
  title: string;
  servings: number;
  source_type: SourceType;
  source_name: string | null;
  source_url: string | null;
  ingredientsText: string;
  stepsText: string;
  nutrition?: Nutrition;
  meals?: MealId[];
};

// The columns every recipe read selects.
export const RECIPE_COLUMNS =
  "id, title, servings, source_type, source_name, source_url, steps, favorite, calories, protein_g, carbs_g, fat_g, meals";

export function nutritionOf(
  row: Pick<RecipeRow, "calories" | "protein_g" | "carbs_g" | "fat_g">,
): Nutrition {
  return { calories: row.calories, protein: row.protein_g, carbs: row.carbs_g, fat: row.fat_g };
}
