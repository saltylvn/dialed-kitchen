"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { FoodEmoji } from "@/components/ui/FoodEmoji";
import { shrinkPhoto } from "@/components/shrinkPhoto";
import { useToday } from "@/components/useToday";
import { MAX_PHOTOS } from "@/lib/photos";
import {
  choiceLabel,
  choicesFor,
  choiceUnit,
  DIMENSIONS,
  isUnitChoice,
  UNITS,
  type Dimension,
  type Unit,
  type UnitChoice,
} from "@/lib/units";
import { StoreWheel } from "@/features/prices/components/StoreWheel";
import type { StoreRow } from "@/features/prices/schema";
import {
  saveReceipt,
  scanReceipt,
  type SaveReceiptResult,
  type ScanReceiptResult,
} from "../actions";
import type { ReceiptDraft } from "../schema";

// Scan a receipt (docs/decisions/0033, 0035): photograph it with the camera (no uploads),
// let the AI read the lines, then check each one (which item, price, size) before saving
// them all as prices at that store.

export type PriceBookItem = { id: string; name: string; compareUnit: Unit };

const RECEIPT_MAX_SIDE = 2400; // pixels: receipt print is small
const box = "border-border bg-surface min-h-12 rounded-xl border px-3 text-[17px]";
const GROUPS: Dimension[] = ["weight", "volume", "count"];

export function ReceiptScanner({ items, stores }: { items: PriceBookItem[]; stores: StoreRow[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Blob[]>([]); // taken so far, already shrunk
  const [shrinking, setShrinking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [scan, scanAction, reading] = useActionState<ScanReceiptResult, FormData>(
    async (prev, form) => {
      const next = await scanReceipt(prev, form);
      if (next?.ok) setDraft(next.data);
      return next;
    },
    null,
  );
  const busy = shrinking || reading;

  // Camera only (capture), one photo at a time: a long receipt takes up to MAX_PHOTOS shots,
  // top to bottom, then one Read for all of them.
  async function onTake(file: File | undefined) {
    if (!file) return;
    setLocalError(null);
    setShrinking(true);
    try {
      const shrunk = await shrinkPhoto(file, RECEIPT_MAX_SIDE);
      setPhotos((taken) => [...taken, shrunk].slice(0, MAX_PHOTOS));
    } catch {
      setLocalError("Couldn't use that photo. Try taking it again.");
    } finally {
      setShrinking(false);
      if (input.current) input.current.value = ""; // taking another works the same way
    }
  }

  function read() {
    const form = new FormData();
    photos.forEach((photo, i) => form.append("photo", photo, `receipt-${i + 1}.jpg`));
    startTransition(() => scanAction(form));
  }

  if (draft) {
    return (
      <ReceiptReview
        // A new scan starts a fresh review.
        key={JSON.stringify(draft.lines.map((l) => l.text))}
        draft={draft}
        items={items}
        stores={stores}
        onRestart={() => {
          setDraft(null);
          setPhotos([]);
        }}
      />
    );
  }

  const error = localError ?? (scan?.ok === false ? scan.error : null);
  const cameraButton = (label: string, primary: boolean) => (
    <label
      className={`flex min-h-12 items-center justify-center rounded-xl px-4 font-medium ${
        primary ? "bg-accent text-on-accent" : "border-border bg-surface border"
      } ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
    >
      {shrinking ? "Preparing…" : label}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment" // opens the camera; no uploads from the photo library
        disabled={busy}
        className="sr-only"
        onChange={(e) => void onTake(e.target.files?.[0])}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-[17px]">
        Take a photo of a grocery receipt. The app reads each line, matches it to your price book,
        and you check everything before it&apos;s saved.
      </p>

      {photos.length === 0 ? (
        cameraButton("📷 Take a photo", true)
      ) : (
        <>
          <p role="status" className="font-medium">
            ✓ {photos.length} {photos.length === 1 ? "photo" : "photos"} taken
          </p>
          <button
            type="button"
            onClick={read}
            disabled={busy}
            className="bg-accent text-on-accent min-h-12 w-full rounded-xl font-medium disabled:opacity-60"
          >
            {reading ? "Reading the receipt…" : "Read the receipt"}
          </button>
          {photos.length < MAX_PHOTOS &&
            !reading &&
            cameraButton("📷 Long receipt? Take the next part", false)}
          {!reading && (
            <button
              type="button"
              onClick={() => setPhotos([])}
              className="text-muted min-h-12 w-full font-medium underline"
            >
              Start over
            </button>
          )}
        </>
      )}

      {reading && (
        <p role="status" className="text-muted text-[15px]">
          This can take up to half a minute.
        </p>
      )}
      {error && (
        <p role="alert" className="font-medium">
          ⚠️ {error}
        </p>
      )}
      <p className="text-muted text-[15px]">
        Uses one of your daily AI requests. The photos are never stored.
      </p>
    </div>
  );
}

type Row = {
  text: string;
  choice: string; // an item id, "new" or "skip"
  newName: string;
  price: string;
  quantity: string;
  unit: UnitChoice; // a real unit, or a package size like "½ gal"
  onSale: boolean;
  remembered: boolean;
  checkSize: boolean; // the unit was changed to fit the chosen item: worth a look
};

function ReceiptReview({
  draft,
  items,
  stores,
  onRestart,
}: {
  draft: ReceiptDraft;
  items: PriceBookItem[];
  stores: StoreRow[];
  onRestart: () => void;
}) {
  const today = useToday();
  const byId = new Map(items.map((i) => [i.id, i]));
  const [rows, setRows] = useState<Row[]>(() =>
    draft.lines.map((line) =>
      fitToItem(
        {
          text: line.text,
          choice: line.suggestedItemId ?? "new",
          newName: line.name,
          price: line.price.toFixed(2),
          quantity: String(line.quantity),
          unit: line.unit,
          onSale: line.onSale,
          remembered: line.remembered,
          checkSize: false,
        },
        line.suggestedItemId ? byId.get(line.suggestedItemId) : undefined,
      ),
    ),
  );
  const [result, setResult] = useState<SaveReceiptResult>(null);
  const [saving, startSaving] = useTransition();

  function update(index: number, change: Partial<Row>) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...change };
        return change.choice ? fitToItem(next, byId.get(change.choice)) : next;
      }),
    );
  }

  const kept = rows.filter((r) => r.choice !== "skip");

  function onSave(form: FormData) {
    setResult(null);
    startSaving(async () => {
      setResult(
        await saveReceipt({
          storeId: String(form.get("storeId") ?? ""),
          observedOn: String(form.get("observedOn") ?? ""),
          lines: kept.map((r) => ({
            receiptText: r.text,
            itemId: r.choice === "new" ? null : r.choice,
            newItemName: r.choice === "new" ? r.newName : null,
            price: r.price,
            quantity: r.quantity,
            unit: r.unit,
            onSale: r.onSale,
          })),
        }),
      );
    });
  }

  if (result?.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="border-border bg-surface rounded-xl border p-4 font-medium">
          ✓ Saved {result.data.saved} {result.data.saved === 1 ? "price" : "prices"}
          {result.data.created > 0 &&
            `, with ${result.data.created} new ${result.data.created === 1 ? "item" : "items"} in your price book`}
          . Next time, this store&apos;s receipt lines are recognized.
        </p>
        <Link
          href="/grocery/prices"
          className="bg-accent text-on-accent flex min-h-12 items-center justify-center rounded-xl font-medium"
        >
          See Price Tracker
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="border-border min-h-12 w-full rounded-xl border font-medium"
        >
          Scan another receipt
        </button>
      </div>
    );
  }

  return (
    <form action={onSave} className="space-y-5">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <p id="receipt-store" className="font-medium">
            Store
          </p>
          <div role="group" aria-labelledby="receipt-store" className="mt-2">
            <StoreWheel name="storeId" stores={stores} currentId={draft.storeId} />
          </div>
        </div>
        <div className="w-40 shrink-0">
          <label htmlFor="receipt-date" className="font-medium">
            Date
          </label>
          <input
            key={today}
            id="receipt-date"
            name="observedOn"
            type="date"
            required
            defaultValue={draft.date ?? today}
            max={today || undefined}
            className={`${box} mt-2 w-full`}
          />
        </div>
      </div>

      <p className="text-muted text-[15px]">
        {rows.length} {rows.length === 1 ? "line" : "lines"} read. Check each one: the item it goes
        to, the price for one, and the size. &quot;Don&apos;t save&quot; skips a line.
      </p>

      <ol className="space-y-3">
        {rows.map((row, i) => {
          const item = byId.get(row.choice);
          const dimension = item ? UNITS[item.compareUnit].dimension : null;
          return (
            <li
              key={i}
              className={`border-border bg-surface space-y-3 rounded-2xl border p-4 ${
                row.choice === "skip" ? "opacity-60" : ""
              }`}
            >
              <p className="text-muted flex items-center justify-between gap-2 font-mono text-[14px]">
                <span className="break-all">{row.text}</span>
                {row.remembered && row.choice !== "skip" && (
                  <span className="border-border shrink-0 rounded-md border px-1.5 font-sans text-[13px]">
                    ✓ Remembered
                  </span>
                )}
              </p>
              <div>
                <label htmlFor={`line-${i}-item`} className="sr-only">
                  Item for {row.text}
                </label>
                <select
                  id={`line-${i}-item`}
                  value={row.choice}
                  onChange={(e) => update(i, { choice: e.target.value })}
                  className={`${box} w-full`}
                >
                  <option value="new">＋ New item: {row.newName || "…"}</option>
                  <option value="skip">Don&apos;t save this line</option>
                  <optgroup label="Your price book">
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              {row.choice === "new" && (
                <div>
                  <label htmlFor={`line-${i}-name`} className="text-muted text-[15px]">
                    New item name
                  </label>
                  <input
                    id={`line-${i}-name`}
                    value={row.newName}
                    maxLength={80}
                    required
                    autoComplete="off"
                    onChange={(e) => update(i, { newName: e.target.value })}
                    className={`${box} mt-1 w-full`}
                  />
                </div>
              )}
              {row.choice !== "skip" && (
                <>
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-[17px]">
                      <FoodEmoji name={item?.name ?? row.newName} />
                    </span>
                    <label className="sr-only" htmlFor={`line-${i}-price`}>
                      Price for one
                    </label>
                    <span aria-hidden>$</span>
                    <input
                      id={`line-${i}-price`}
                      inputMode="decimal"
                      required
                      value={row.price}
                      onChange={(e) => update(i, { price: e.target.value })}
                      className={`${box} w-24 min-w-0`}
                    />
                    <span className="text-muted">for</span>
                    <label className="sr-only" htmlFor={`line-${i}-size`}>
                      Size
                    </label>
                    <input
                      id={`line-${i}-size`}
                      inputMode="decimal"
                      required
                      value={row.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value, checkSize: false })}
                      className={`${box} w-16 min-w-0`}
                    />
                    <label className="sr-only" htmlFor={`line-${i}-unit`}>
                      Unit
                    </label>
                    <select
                      id={`line-${i}-unit`}
                      value={row.unit}
                      onChange={(e) => {
                        const unit = e.target.value;
                        if (isUnitChoice(unit)) update(i, { unit, checkSize: false });
                      }}
                      className={`${box} min-w-0 flex-1 px-2`}
                    >
                      {(dimension ? [dimension] : GROUPS).map((d) => (
                        <optgroup key={d} label={DIMENSIONS[d].label}>
                          {choicesFor(d).map((u) => (
                            <option key={u} value={u}>
                              {choiceLabel(u)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {row.checkSize && (
                    <p className="text-[15px] font-medium">
                      ⚠️ {item?.name} is priced{" "}
                      {DIMENSIONS[dimension ?? "count"].label.toLowerCase()}: check the size.
                    </p>
                  )}
                  <label className="flex min-h-12 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={row.onSale}
                      onChange={(e) => update(i, { onSale: e.target.checked })}
                      className="accent-accent size-5"
                    />
                    On sale
                  </label>
                </>
              )}
            </li>
          );
        })}
      </ol>

      {result?.ok === false && (
        <p role="alert" className="font-medium">
          ⚠️ {result.error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="border-border min-h-12 flex-1 rounded-xl border font-medium"
        >
          Start over
        </button>
        <button
          type="submit"
          disabled={saving || kept.length === 0 || !today}
          className="bg-accent text-on-accent min-h-12 flex-[2] rounded-xl font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : `Save ${kept.length} ${kept.length === 1 ? "price" : "prices"}`}
        </button>
      </div>
    </form>
  );
}

// When a line goes to an item priced another way (a receipt "each" for an item priced per
// lb), switch the unit to the item's and flag the size to check, rather than save a size
// the database would refuse.
function fitToItem(row: Row, item: PriceBookItem | undefined): Row {
  if (!item) return row;
  const dimension = UNITS[item.compareUnit].dimension;
  if (UNITS[choiceUnit(row.unit)].dimension === dimension) return { ...row, checkSize: false };
  return { ...row, unit: item.compareUnit, quantity: "1", checkSize: true };
}
