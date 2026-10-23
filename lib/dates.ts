// Calendar dates as "YYYY-MM-DD": the shopper's own local date, never a UTC timestamp, so a
// price entered at 11pm doesn't land on tomorrow.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Today in the device's own time zone (browser code), as YYYY-MM-DD.
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The server's idea of today (UTC). Only used for checks with a day of slack, since the
// shopper's local date can be a day either side of it.
export function serverToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// "Oct 3", or "Oct 3, 2025" when it's not the current year. No time-zone shifting.
export function formatShortDate(isoDate: string, currentYear?: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: currentYear === undefined || y === currentYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Adds whole days to a YYYY-MM-DD date.
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
