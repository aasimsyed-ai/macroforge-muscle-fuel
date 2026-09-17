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

/** The single prior turn, if any — just enough for "What should I do next?"
 * style follow-ups to resolve against the topic just discussed. Deliberately
 * not a full transcript or a stored memory: only ever the one message pair
 * the caller currently has in view. */
export interface HalkuPreviousTurn {
  question: string;
  answer: string;
}

/**
 * Tries the `halku-chat` Gemini edge function first (free-form, real LLM
 * answers) and falls back to the local rule-based responder whenever it's
 * missing, errors, times out, or isn't deployed yet — the same "safe to ship
 * undeployed" contract as analyze-food.
 */
export async function answerHalkuQuestion(
  question: string,
  data: HalkuKnownData,
  previous?: HalkuPreviousTurn,
): Promise<HalkuAnswer> {
  const remote = await tryRemoteHalku(question, data, previous);
  return remote ?? answerHalkuQuestionLocally(question, data, previous?.question);
}

async function tryRemoteHalku(
  question: string,
  data: HalkuKnownData,
  previous?: HalkuPreviousTurn,
): Promise<HalkuAnswer | null> {
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
      body: JSON.stringify({ question, data, previous }),
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
