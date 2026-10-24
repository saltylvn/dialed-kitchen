import "server-only";
import { createClient } from "./supabase";

// AI requests per person per rolling 24 hours, shared by photo reads and nutrition estimates.
// Protects the free Gemini quota (docs/decisions/0016). The database counts atomically.
export const DAILY_AI_LIMIT = 40;

// Takes one request from today's allowance: "ok", "limit" (none left), or "error".
export async function takeAiRequest(): Promise<"ok" | "limit" | "error"> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("take_ai_request", { daily_limit: DAILY_AI_LIMIT });
  if (error) {
    console.error("take_ai_request failed:", error.message);
    return "error";
  }
  return data === true ? "ok" : "limit";
}
