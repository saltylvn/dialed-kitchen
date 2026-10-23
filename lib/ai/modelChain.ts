// Which Gemini models to try, in order, and what to do when one fails (docs/decisions/0016).
// All are on Google's free tier, and all read images. Google sometimes overloads a model
// (HTTP 503) or retires one, so the app falls back to the next. Adapted from DEVELOP.

// Best first. Checked against the models this project's key can use (Oct 2026).
export const MODEL_CHAIN = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
] as const;

export type ErrorAction = "try-next-model" | "stop";

// After a failed request: is the next model worth trying, or will every model fail the
// same way? Overload, timeouts and retired models are model-specific; a bad key isn't.
export function classifyGeminiError(error: {
  status?: number;
  message?: string;
  timedOut?: boolean;
}): ErrorAction {
  if (error.timedOut) return "try-next-model";
  const { status, message = "" } = error;
  if (status === 401 || status === 403 || /api key/i.test(message)) return "stop";
  return "try-next-model"; // 429 busy, 5xx overloaded, 404 retired, 400 model-specific
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
