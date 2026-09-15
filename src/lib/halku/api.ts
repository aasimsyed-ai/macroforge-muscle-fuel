import { answerHalkuQuestionLocally } from "./respond";
import type { HalkuAnswer, HalkuKnownData } from "./types";

// Same env-lookup shape as src/lib/food-estimate.ts's analyze-food caller —
// intentionally duplicated rather than imported, since food-estimate.ts
// doesn't export these and this keeps Halku independent of the food module.
const SUPABASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env["VITE_SUPABASE_URL"]) ||
  "";
const SUPABASE_KEY: string =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) ||
  "";

/**
 * Tries the `halku-chat` Gemini edge function first (free-form, real LLM
 * answers) and falls back to the local rule-based responder whenever it's
 * missing, errors, times out, or isn't deployed yet — the same "safe to ship
 * undeployed" contract as analyze-food. Right now `halku-chat` is a dormant
 * scaffold (not deployed), so every answer comes from the local responder;
 * the moment it's deployed, answers upgrade automatically with no client
 * change needed.
 */
export async function answerHalkuQuestion(
  question: string,
  data: HalkuKnownData,
): Promise<HalkuAnswer> {
  const remote = await tryRemoteHalku(question, data);
  return remote ?? answerHalkuQuestionLocally(question, data);
}

async function tryRemoteHalku(question: string, data: HalkuKnownData): Promise<HalkuAnswer | null> {
  if (!SUPABASE_URL) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/halku-chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ question, data }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) return null;
    const json = (await res.json()) as { text?: string; grounded?: boolean; error?: string };
    if (json.error || typeof json.text !== "string" || !json.text.trim()) return null;
    return { text: json.text, grounded: json.grounded === true };
  } catch {
    return null;
  }
}
