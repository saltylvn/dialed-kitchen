import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/server/supabase";

// What's In stock in the household's kitchen (server-only, RLS-scoped, validated).

const stockRowSchema = z.object({ id: z.uuid(), name: z.string(), key: z.string() });
export type StockRow = z.infer<typeof stockRowSchema>;

export async function listInStock(): Promise<StockRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pantry_items").select("id, name, key").order("key");
  if (error) throw new Error(`pantry_items failed: ${error.message}`);
  return z.array(stockRowSchema).parse(data);
}

// Just the match keys, for "is this In stock?" checks.
export async function inStockKeys(): Promise<Set<string>> {
  return new Set((await listInStock()).map((row) => row.key));
}
