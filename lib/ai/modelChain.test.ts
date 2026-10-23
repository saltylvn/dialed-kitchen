import { describe, expect, it } from "vitest";
import { classifyGeminiError, isTimeoutError, MODEL_CHAIN } from "./modelChain";

describe("model chain", () => {
  it("has distinct models, best first", () => {
    expect(new Set(MODEL_CHAIN).size).toBe(MODEL_CHAIN.length);
    expect(MODEL_CHAIN[0]).toBe("gemini-3.5-flash");
  });

  it("tries the next model when one is busy, overloaded, retired or slow", () => {
    for (const error of [
      { status: 429 },
      { status: 503 },
      { status: 500 },
      { status: 404 },
      { timedOut: true },
    ]) {
      expect(classifyGeminiError(error), JSON.stringify(error)).toBe("try-next-model");
    }
  });

  it("stops when the key itself is the problem (every model would fail)", () => {
    expect(classifyGeminiError({ status: 403 })).toBe("stop");
    expect(classifyGeminiError({ status: 400, message: "API key not valid" })).toBe("stop");
  });

  it("recognizes timeouts", () => {
    expect(isTimeoutError(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe(true);
    expect(isTimeoutError(new Error("x"))).toBe(false);
  });
});
