import { describe, expect, it } from "vitest";
import {
  dayLabels,
  MEALS,
  mondayOf,
  rankRecipes,
  weekDays,
  weekFromParam,
  weekRangeLabel,
} from "./plan";

describe("meals", () => {
  it("are Breakfast, Lunch, Snacks, Dinner, in that order", () => {
    expect(MEALS.map((m) => m.label)).toEqual(["Breakfast", "Lunch", "Snacks", "Dinner"]);
  });
});

describe("weeks", () => {
  it("start on Monday", () => {
    expect(mondayOf("2026-10-26")).toBe("2026-10-26"); // a Monday
    expect(mondayOf("2026-10-28")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // Sunday belongs to the week before
  });

  it("cross months and years", () => {
    expect(weekDays("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("read ?week= safely", () => {
    expect(weekFromParam("2026-10-29")).toBe("2026-10-26");
    for (const bad of [undefined, "", "2026-02-30", "next week", ["2026-10-26"], "1999-01-04"]) {
      expect(weekFromParam(bad), String(bad)).toBeNull();
    }
  });

  it("have readable labels", () => {
    expect(dayLabels("2026-10-26")).toEqual({ weekday: "Monday", date: "Oct 26" });
    expect(weekRangeLabel("2026-10-26")).toBe("Oct 26 – Nov 1");
  });
});

describe("rankRecipes", () => {
  const r = (title: string, favorite: boolean, timesPlanned: number) => ({
    title,
    favorite,
    timesPlanned,
  });

  it("puts favorites and regulars on top, most planned first", () => {
    const { top, rest } = rankRecipes([
      r("Tacos", false, 4),
      r("Biscuits", true, 0),
      r("Chili", true, 2),
      r("Soup", false, 2),
      r("Salad", false, 0),
    ]);
    expect(top.map((x) => x.title)).toEqual(["Tacos", "Chili", "Biscuits"]);
    expect(rest.map((x) => x.title)).toEqual(["Soup", "Salad"]);
  });
});
