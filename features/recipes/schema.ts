import { z } from "zod";
import { parseIngredientLines, type ParsedIngredient } from "@/lib/ingredients";
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
