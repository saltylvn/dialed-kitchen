import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { classifyGeminiError, isTimeoutError, MODEL_CHAIN } from "@/lib/ai/modelChain";
import {
  parseRecipeAnswer,
  RECIPE_PROMPT,
  RECIPE_RESPONSE_SCHEMA,
  type RecipeFromImage,
} from "@/lib/ai/recipeFromImage";

// The ONLY file that talks to Google (docs/decisions/0016). The key is read here, on the
// server, and never reaches the browser. Swapping AI providers means changing this file.

// The photo action may run up to 60 seconds (maxDuration on /recipes/new). Stop starting
// new models after ~50, and give any one model at most 20, so a stuck one doesn't eat the whole wait.
const TOTAL_BUDGET_MS = 50_000;
const PER_MODEL_TIMEOUT_MS = 20_000;
const MIN_ATTEMPT_MS = 8_000;

export type ReadRecipeResult =
  | { ok: true; recipe: RecipeFromImage }
  | { ok: false; reason: "not_configured" | "busy" | "no_recipe" | "failed" };

export async function readRecipeFromPhotos(
  photos: readonly Uint8Array[],
): Promise<ReadRecipeResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "not_configured" };

  const ai = new GoogleGenAI({ apiKey });
  const parts = [
    ...photos.map((bytes) => ({
      inlineData: { mimeType: "image/jpeg", data: Buffer.from(bytes).toString("base64") },
    })),
    { text: "Copy the recipe in these photos." },
  ];
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let last: ReadRecipeResult = { ok: false, reason: "busy" };

  // Google's free models are sometimes overloaded or retired: try each in turn.
  for (const model of MODEL_CHAIN) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: RECIPE_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: RECIPE_RESPONSE_SCHEMA,
          temperature: 0, // copy, don't create
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: AbortSignal.timeout(Math.min(PER_MODEL_TIMEOUT_MS, remaining)),
        },
      });

      const parsed = parseRecipeAnswer(response.text ?? "");
      if (parsed.ok) return parsed;
      // "No recipe here" is a real answer. A garbled one is this model's bad moment.
      if (parsed.reason === "no_recipe") return { ok: false, reason: "no_recipe" };
      console.error(`Gemini ${model} gave an unusable answer: ${parsed.reason}`);
      last = { ok: false, reason: "failed" };
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      const message = error instanceof Error ? error.message : "";
      const timedOut = isTimeoutError(error);
      // Log enough to debug, never the key or the photos.
      console.error(
        `Gemini ${model} failed:`,
        timedOut ? "timed out" : `${status ?? "?"} ${message.slice(0, 160)}`,
      );
      if (classifyGeminiError({ status, message, timedOut }) === "stop") {
        return { ok: false, reason: "failed" };
      }
      last = { ok: false, reason: "busy" };
    }
  }
  return last;
}
