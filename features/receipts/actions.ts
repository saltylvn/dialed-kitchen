"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GENERIC_ERROR, type ActionResult } from "@/lib/actionResult";
import { checkPhotos } from "@/lib/photos";
import { nameKey } from "@/lib/priceBook";
import { compareUnitFor, detectStore, suggestItem } from "@/lib/receipt";
import { requireUser } from "@/lib/server/auth";
import { DAILY_AI_LIMIT, takeAiRequest } from "@/lib/server/aiLimit";
import { readReceiptFromPhotos } from "@/lib/server/gemini";
import { createClient } from "@/lib/server/supabase";
import { UNITS } from "@/lib/units";
import { storeRowSchema } from "@/features/prices/schema";
import { saveReceiptSchema, type ReceiptDraft, type SaveReceiptInput } from "./schema";

// Scanning a receipt (docs/decisions/0033): read it with AI and suggest a price-book item
// for each line (nothing saved), then save what the person reviewed, in a few batch writes.
// Photos are checked by their bytes, sent to Gemini and never stored.

const SCAN_ERRORS = {
  not_configured: "Reading receipts isn't set up yet.",
  busy: "The AI is busy right now (free tier). Try again in a minute.",
  no_receipt: "Couldn't find a receipt in that photo. Try a sharper, flatter photo in good light.",
  failed: "Couldn't read that receipt. Try again, or take the photo again.",
} as const;

export type ScanReceiptResult = ActionResult<ReceiptDraft> | null;

export async function scanReceipt(
  _prev: ScanReceiptResult,
  formData: FormData,
): Promise<ScanReceiptResult> {
  await requireUser();
  const files = formData.getAll("photo");
  if (!files.every((f): f is File => f instanceof File)) {
    return { ok: false, error: SCAN_ERRORS.failed };
  }
  // (The whole request is capped at 4 MB by serverActions.bodySizeLimit in next.config.ts.)
  const photos = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())));
  const check = checkPhotos(photos, "receipt");
  if (!check.ok) return check;

  const allowance = await takeAiRequest(); // one of the day's AI requests, counted by the database
  if (allowance === "error") return { ok: false, error: SCAN_ERRORS.failed };
  if (allowance === "limit") {
    return {
      ok: false,
      error: `You've used all ${DAILY_AI_LIMIT} AI requests for the last day. Try again tomorrow.`,
    };
  }

  const supabase = await createClient();
  const [read, items, stores] = await Promise.all([
    readReceiptFromPhotos(photos),
    supabase.from("items").select("id, name"),
    supabase.from("stores").select("id, name"),
  ]);
  if (!read.ok) return { ok: false, error: SCAN_ERRORS[read.reason] };
  if (items.error || stores.error) {
    console.error("receipt scan lookup failed:", items.error?.message ?? stores.error?.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  const itemList = z.array(z.object({ id: z.uuid(), name: z.string() })).parse(items.data);
  const store = detectStore(read.receipt.storeName, z.array(storeRowSchema).parse(stores.data));

  // Matches remembered from earlier receipts at this store.
  const remembered = new Map<string, string>();
  if (store) {
    const { data, error } = await supabase
      .from("receipt_aliases")
      .select("receipt_text, item_id")
      .eq("store_id", store.id);
    if (error) console.error("receipt aliases read failed:", error.message);
    for (const row of z
      .array(z.object({ receipt_text: z.string(), item_id: z.uuid() }))
      .parse(data ?? [])) {
      remembered.set(row.receipt_text, row.item_id);
    }
  }

  return {
    ok: true,
    data: {
      storeId: store?.id ?? null,
      date: read.receipt.date,
      lines: read.receipt.lines.map((line) => {
        const suggestion = suggestItem(line, itemList, remembered);
        return {
          ...line,
          suggestedItemId: suggestion?.itemId ?? null,
          remembered: suggestion?.how === "remembered",
        };
      }),
    },
  };
}

export type SaveReceiptResult = ActionResult<{ saved: number; created: number }> | null;

// Saves a reviewed receipt: new items first (or existing ones with the same name), then every
// price in one insert (all or nothing), then the receipt texts to recognize next time.
// RLS and the database's checks apply to all of it, as for any typed price.
export async function saveReceipt(input: SaveReceiptInput): Promise<SaveReceiptResult> {
  await requireUser();
  const parsed = saveReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the receipt" };
  }
  const { storeId, observedOn, lines } = parsed.data;
  const supabase = await createClient();

  const { data: itemData, error: itemsError } = await supabase
    .from("items")
    .select("id, name, dimension");
  if (itemsError) {
    console.error("receipt save lookup failed:", itemsError.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  const items = z
    .array(z.object({ id: z.uuid(), name: z.string(), dimension: z.string() }))
    .parse(itemData);
  const byId = new Map(items.map((i) => [i.id, i]));
  const byName = new Map(items.map((i) => [nameKey(i.name), i]));

  // New items, once each, unless one with that name already exists.
  const toCreate = new Map<string, { name: string; compare_unit: string; dimension: string }>();
  for (const line of lines) {
    if (line.newItemName === null || byName.has(nameKey(line.newItemName))) continue;
    const compare = compareUnitFor(line.unit);
    toCreate.set(nameKey(line.newItemName), {
      name: line.newItemName,
      compare_unit: compare,
      dimension: UNITS[compare].dimension,
    });
  }
  let created = 0;
  if (toCreate.size > 0) {
    const { data, error } = await supabase
      .from("items")
      .insert([...toCreate.values()])
      .select("id, name, dimension");
    if (error) {
      console.error("receipt new items failed:", error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    for (const item of z
      .array(z.object({ id: z.uuid(), name: z.string(), dimension: z.string() }))
      .parse(data)) {
      byId.set(item.id, item);
      byName.set(nameKey(item.name), item);
      created++;
    }
  }

  // Each line's item, and a size that measures the same thing (no pounds of milk).
  const prices = [];
  const learned = new Map<string, string>(); // receipt text → item, to recognize next time
  for (const [i, line] of lines.entries()) {
    const item = line.itemId ? byId.get(line.itemId) : byName.get(nameKey(line.newItemName ?? ""));
    if (!item) return { ok: false, error: `Line ${i + 1}: that item no longer exists.` };
    if (UNITS[line.unit].dimension !== item.dimension) {
      return {
        ok: false,
        error: `Line ${i + 1} (${item.name}): its size unit doesn't fit how the item is priced. Change the unit.`,
      };
    }
    prices.push({
      item_id: item.id,
      store_id: storeId,
      price: line.price,
      package_quantity: line.quantity,
      package_unit: line.unit,
      observed_on: observedOn,
    });
    if (line.receiptText) learned.set(line.receiptText, item.id); // the last match of a text wins
  }

  const { error: pricesError } = await supabase.from("item_prices").insert(prices);
  if (pricesError) {
    console.error("receipt prices failed:", pricesError.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  // Remember each receipt text for this store. A failure here only means no suggestion next
  // time, so it's logged, not shown.
  if (learned.size > 0) {
    const { error } = await supabase.from("receipt_aliases").upsert(
      [...learned].map(([receipt_text, item_id]) => ({ store_id: storeId, receipt_text, item_id })),
      { onConflict: "household_id,store_id,receipt_text" },
    );
    if (error) console.error("receipt aliases save failed:", error.message);
  }

  revalidatePath("/grocery", "layout");
  return { ok: true, data: { saved: prices.length, created } };
}
