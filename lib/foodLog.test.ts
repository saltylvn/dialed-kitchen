import { describe, expect, it } from "vitest";
import { dayTotals, formatPortion, GOAL_CALORIES, progress, type LogEntry } from "./foodLog";

const entry = (over: Partial<LogEntry>): LogEntry => ({
  id: "1",
  logDate: "2026-11-23",
  meal: "breakfast",
  planEntryId: null,
  label: "Shake",
  portion: 1,
  calories: 400,
  protein: 30,
  ...over,
});

describe("dayTotals", () => {
  it("adds up one day only", () => {
    const totals = dayTotals(
      [
        entry({}),
        entry({ id: "2", calories: 250, protein: 12.4 }),
        entry({ id: "3", logDate: "2026-11-24", calories: 999 }),
      ],
      "2026-11-23",
    );
    expect(totals).toEqual({ calories: 650, protein: 42, uncounted: [] });
  });

  it("names entries without calories instead of counting them as zero", () => {
    const totals = dayTotals(
      [entry({ label: "Tacos", calories: null, protein: null })],
      "2026-11-23",
    );
    expect(totals).toEqual({ calories: 0, protein: 0, uncounted: ["Tacos"] });
  });
});

describe("progress", () => {
  it("shows what's left under the goal", () => {
    expect(progress(1500, 2000)).toEqual({
      eaten: 1500,
      goal: 2000,
      left: 500,
      over: 0,
      percent: 75,
    });
  });

  it("shows how far over, with the bar full", () => {
    expect(progress(2300, 2000)).toMatchObject({ left: 0, over: 300, percent: 100 });
  });
});

describe("formatPortion", () => {
  it("writes halves and quarters as fractions", () => {
    expect([0.5, 1, 1.5, 2, 2.25, 0.75].map(formatPortion)).toEqual([
      "½",
      "1",
      "1½",
      "2",
      "2¼",
      "¾",
    ]);
  });

  it("falls back to the plain number", () => {
    expect(formatPortion(1.3)).toBe("1.3");
  });
});

describe("goal wheel", () => {
  it("runs from 1,000 to 5,000 kcal in steps of 50", () => {
    expect(GOAL_CALORIES[0]).toBe(1000);
    expect(GOAL_CALORIES.at(-1)).toBe(5000);
  });
});
