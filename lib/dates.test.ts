import { describe, expect, it } from "vitest";
import { addDays, formatShortDate, isIsoDate, localToday, serverToday } from "./dates";

describe("dates", () => {
  it("accepts only real YYYY-MM-DD dates", () => {
    expect(isIsoDate("2026-10-23")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true); // leap year
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "2026-1-5",
      "10/23/2026",
      "",
      "2026-10-23T00:00",
    ]) {
      expect(isIsoDate(bad), bad).toBe(false);
    }
  });

  it("uses the device's local date, not UTC", () => {
    // 11:30pm on Oct 23 local time is still Oct 23, whatever UTC says.
    expect(localToday(new Date(2026, 9, 23, 23, 30))).toBe("2026-10-23");
    expect(serverToday(new Date(Date.UTC(2026, 9, 24, 5, 0)))).toBe("2026-10-24");
  });

  it("formats short dates without shifting days", () => {
    expect(formatShortDate("2026-10-03", 2026)).toBe("Oct 3");
    expect(formatShortDate("2025-12-31", 2026)).toBe("Dec 31, 2025");
  });

  it("adds days across months", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});
