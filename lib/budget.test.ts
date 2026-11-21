import { describe, expect, it } from "vitest";
import { BUDGET_CHOICES } from "./budget";

describe("BUDGET_CHOICES", () => {
  it("offers none, then $25 to $1,000 in $25 steps", () => {
    expect(BUDGET_CHOICES[0]).toBe(0);
    expect(BUDGET_CHOICES[1]).toBe(25);
    expect(BUDGET_CHOICES.at(-1)).toBe(1000);
    expect(BUDGET_CHOICES).toHaveLength(41);
  });
});
