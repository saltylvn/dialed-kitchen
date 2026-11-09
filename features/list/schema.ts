import { z } from "zod";
import { isUnit, type Unit } from "@/lib/units";
import { parseQuantity } from "@/features/prices/schema";

// Valid input for the grocery list, and the shape of list rows read back.

export const addToListSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Type what you need").max(80, "Keep it under 80 characters")),
  // Amount is optional: "Bananas", "Bananas 6", or "Rice 2 lb".
  quantity: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s?.trim()) return null;
      const value = parseQuantity(s);
      if (value === null || value <= 0 || value >= 1000000) {
        ctx.addIssue({
          code: "custom",
          message: "Enter an amount like 2 or 1.5, or leave it empty",
        });
        return z.NEVER;
      }
      return value;
    }),
  unit: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return null;
      if (!isUnit(s)) {
        ctx.addIssue({ code: "custom", message: "Choose a unit" });
        return z.NEVER;
      }
      return s as Unit;
    }),
});

export const listRowSchema = z.object({
  id: z.uuid(),
  item_id: z.uuid().nullable(),
  name: z.string(),
  quantity: z.coerce.number().nullable(),
  unit: z
    .string()
    .nullable()
    .refine((u) => u === null || isUnit(u))
    .transform((u) => u as Unit | null),
  checked: z.boolean(),
  created_at: z.string(),
});
export type ListRow = z.infer<typeof listRowSchema>;
