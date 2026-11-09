// The stores on the price-logging wheel (docs/decisions/0032, 0035). Pure logic, unit tested.

// The stores on the price-logging wheel, top to bottom, in the owner's order. The first is
// where the wheel starts unless told otherwise (docs/decisions/0032).
export const LOG_STORES = ["Trader Joe's", "WinCo", "Harmons", "Smith's", "Walmart"] as const;

// The household's stores in wheel order. A starting store that isn't on the wheel (Costco)
// is added at the end, so a price logged there still has its store.
export function storesForLogging<S extends { id: string; name: string }>(
  stores: readonly S[],
  currentId: string | null = null,
): { wheel: S[]; start: S | null } {
  const wheel = LOG_STORES.flatMap((name) => stores.filter((s) => s.name === name));
  const current = stores.find((s) => s.id === currentId);
  if (current && !wheel.includes(current)) wheel.push(current);
  return { wheel, start: current ?? wheel[0] ?? null };
}
