import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { classifyGeminiError, isTimeoutError, MODEL_CHAIN } from "@/lib/ai/modelChain";
import {
  NUTRITION_PROMPT,
  NUTRITION_RESPONSE_SCHEMA,
  nutritionPrompt,
  parseNutritionAnswer,
} from "@/lib/ai/nutritionEstimate";
import {
  parseRecipeAnswer,
  RECIPE_PROMPT,
  RECIPE_RESPONSE_SCHEMA,
  type RecipeFromImage,
} from "@/lib/ai/recipeFromImage";
import type { Nutrition } from "@/lib/nutrition";

// The ONLY file that talks to Google (docs/decisions/0016, 0018). The key is read here, on
// the server, and never reaches the browser. Swapping AI providers means changing this file.

// The calling page may run up to 60 seconds (maxDuration). Stop starting new models after
// ~50, and give any one model at most 20, so a stuck one doesn't eat the whole wait.
const TOTAL_BUDGET_MS = 50_000;
const PER_MODEL_TIMEOUT_MS = 20_000;
const MIN_ATTEMPT_MS = 8_000;

type Failure = "not_configured" | "busy" | "failed";

export type ReadRecipeResult =
  { ok: true; recipe: RecipeFromImage } | { ok: false; reason: Failure | "no_recipe" };

export async function readRecipeFromPhotos(
  photos: readonly Uint8Array[],
): Promise<ReadRecipeResult> {
  return askGemini<ReadRecipeResult>({
    parts: [
      ...photos.map((bytes) => ({
        inlineData: { mimeType: "image/jpeg", data: Buffer.from(bytes).toString("base64") },
      })),
      { text: "Copy the recipe in these photos." },
    ],
    systemInstruction: RECIPE_PROMPT,
    schema: RECIPE_RESPONSE_SCHEMA,
    maxOutputTokens: 8192,
    read: (text) => {
      const parsed = parseRecipeAnswer(text);
      if (parsed.ok) return { done: parsed };
      // "No recipe here" is a real answer. A garbled one is this model's bad moment.
      if (parsed.reason === "no_recipe") return { done: { ok: false, reason: "no_recipe" } };
      return { retry: parsed.reason };
    },
  });
}

export type EstimateResult =
  { ok: true; nutrition: Nutrition } | { ok: false; reason: Failure | "not_estimable" };

export async function estimateNutrition(recipe: {
  title: string;
  servings: number;
  ingredients: readonly string[];
}): Promise<EstimateResult> {
  return askGemini<EstimateResult>({
    parts: [{ text: nutritionPrompt(recipe) }],
    systemInstruction: NUTRITION_PROMPT,
    schema: NUTRITION_RESPONSE_SCHEMA,
    maxOutputTokens: 1024,
    read: (text) => {
      const parsed = parseNutritionAnswer(text);
      if (parsed.ok) return { done: parsed };
      if (parsed.reason === "not_estimable") {
        return { done: { ok: false, reason: "not_estimable" } };
      }
      return { retry: parsed.reason };
    },
  });
}

// Google's free models are sometimes overloaded, slow or retired, so try each in turn and
// use the first good answer. `read` checks one model's reply: a final answer, or "try the
// next model" (with the reason, for the log).
async function askGemini<T extends { ok: boolean }>(options: {
  parts: Part[];
  systemInstruction: string;
  schema: object;
  maxOutputTokens: number;
  read: (text: string) => { done: T } | { retry: string };
}): Promise<T | { ok: false; reason: Failure }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "not_configured" };

  const ai = new GoogleGenAI({ apiKey });
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let last: { ok: false; reason: Failure } = { ok: false, reason: "busy" };

  for (const model of MODEL_CHAIN) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: options.parts }],
        config: {
          systemInstruction: options.systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: options.schema,
          temperature: 0,
          maxOutputTokens: options.maxOutputTokens,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: AbortSignal.timeout(Math.min(PER_MODEL_TIMEOUT_MS, remaining)),
        },
      });
      const outcome = options.read(response.text ?? "");
      if ("done" in outcome) return outcome.done;
      console.error(`Gemini ${model} gave an unusable answer: ${outcome.retry}`);
      last = { ok: false, reason: "failed" };
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      const message = error instanceof Error ? error.message : "";
      const timedOut = isTimeoutError(error);
      // Log enough to debug, never the key or the content sent.
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
