import { describe, expect, it } from "vitest";
import {
  dayLabels,
  groupByMeal,
  MEALS,
  type MealId,
  rankRecipes,
  startFromParam,
  weekDays,
  weekRangeLabel,
} from "./plan";

describe("meals", () => {
  it("are Breakfast, Lunch, Snacks, Dinner, in that order", () => {
    expect(MEALS.map((m) => m.label)).toEqual(["Breakfast", "Lunch", "Snacks", "Dinner"]);
  });
});

describe("the seven days", () => {
  it("start on any day, today first", () => {
    expect(weekDays("2026-11-21")).toEqual([
      "2026-11-21", // a Saturday, at the top
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
    ]);
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

  it("read ?start= safely, keeping the day as given", () => {
    expect(startFromParam("2026-10-29")).toBe("2026-10-29");
    for (const bad of [undefined, "", "2026-02-30", "next week", ["2026-10-26"], "1999-01-04"]) {
      expect(startFromParam(bad), String(bad)).toBeNull();
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

describe("groupByMeal", () => {
  const r = (title: string, meals: MealId[], favorite = false, timesPlanned = 0) => ({
    title,
    meals,
    favorite,
    timesPlanned,
  });

  it("sorts recipes into the four meals in order, then the unsorted, skipping empty ones", () => {
    const sections = groupByMeal([
      r("Tacos", ["dinner"], true),
      r("Soup", ["lunch", "dinner"]),
      r("Oatmeal", ["breakfast"]),
      r("Mystery", []),
    ]);
    expect(sections.map((s) => [s.label, [...s.top, ...s.rest].map((x) => x.title)])).toEqual([
      ["Breakfast", ["Oatmeal"]],
      ["Lunch", ["Soup"]],
      ["Dinner", ["Tacos", "Soup"]], // a favorite first
      ["Not sorted yet", ["Mystery"]],
    ]);
  });
});
