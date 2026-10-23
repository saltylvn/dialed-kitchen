import { describe, expect, it } from "vitest";
import { GENERIC_ERROR, userMessage } from "./actionResult";

describe("userMessage", () => {
  const allowed = ["You already have a partner"] as const;

  it("passes through an allow-listed message", () => {
    expect(userMessage({ message: "ERROR: You already have a partner" }, allowed)).toBe(
      "You already have a partner",
    );
  });

  it("hides anything else (database internals, stack traces)", () => {
    expect(userMessage({ message: 'relation "x" violates constraint y' }, allowed)).toBe(
      GENERIC_ERROR,
    );
    expect(userMessage(null, allowed)).toBe(GENERIC_ERROR);
  });
});
