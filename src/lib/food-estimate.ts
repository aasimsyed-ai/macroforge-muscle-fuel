/**
 * Food estimation layer.
 *
 * Typed descriptions are turned into nutrition by a deterministic, local
 * pipeline (src/lib/food/*): whole-word food matching → grams → per-100 g maths
 * from a canonical food table → sanity checks. No LLM does any arithmetic, and
 * nothing about the signed-in user can change the result.
 *
 * Photos are the one AI path: the model may only IDENTIFY foods and guess
 * portions. Anything it names that exists in the reference table is re-computed
 * from the table; only unknown foods keep the model's own (labelled "Estimated",
 * sanity-checked) numbers.
 *
 * Every value is labelled approximate in the UI and stays editable before saving.
 */
import { estimateFromText, assembleEstimate, reconcileVisionItems } from "./food/estimator";
import type { VisionItemInput } from "./food/estimator";
import type { AnalyzeInput, FoodAnalyzer, MacroEstimate } from "./food/types";

export type {
  AnalyzeInput,
  EstimatedItem,
  EstimateSource,
  FoodAnalyzer,
  MacroEstimate,
  NutritionFlag,
  NutritionProvenance,
  PortionBasis,
} from "./food/types";
export { parseServingToGrams, splitItems, SERVING_SUGGESTIONS } from "./food/portions";
export { describeEstimateSource, provenanceLabel, weakestProvenance } from "./food/provenance";

export const referenceAnalyzer: FoodAnalyzer = {
  id: "reference_table",
  async analyze({ description, grams }) {
    return estimateFromText(description, grams && grams > 0 ? grams : null);
  },
};

/**
 * Optional extra vision analyzer slot (e.g. injected in tests). The built-in
 * Gemini path below is used automatically when the `analyze-food` edge function
 * is deployed.
 */
let visionAnalyzer: FoodAnalyzer | null = null;

export function setVisionAnalyzer(analyzer: FoodAnalyzer | null) {
  visionAnalyzer = analyzer;
}

export function hasVisionAnalyzer(): boolean {
  return visionAnalyzer !== null;
}

const SUPABASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env["VITE_SUPABASE_URL"]) ||
  "";
const SUPABASE_KEY: string =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) ||
  "";

function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve({
        data: comma >= 0 ? result.slice(comma + 1) : result,
        mimeType: file.type || "image/jpeg",
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Calls the `analyze-food` Gemini edge function. Returns null if unavailable. */
async function analyzeWithGemini(input: AnalyzeInput): Promise<MacroEstimate | null> {
  if (!input.photo || !SUPABASE_URL || typeof FileReader === "undefined") return null;
  try {
    const { data, mimeType } = await fileToBase64(input.photo);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-food`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        imageBase64: data,
        mimeType,
        description: input.description ?? "",
        grams: input.grams ?? null,
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      error?: string;
      confidence?: unknown;
      items?: VisionItemInput[];
    };
    if (j.error || !Array.isArray(j.items) || j.items.length === 0) return null;

    // Only the food names and portion guesses are trusted from the model; the
    // numbers are re-derived from the reference table wherever it knows the food.
    const estimate = assembleEstimate(reconcileVisionItems(j.items), {
      source: "vision_ai",
      confidenceCap: 0.6,
      intro: "Photo estimate",
    });
    const modelConfidence = typeof j.confidence === "number" ? j.confidence : null;
    return {
      ...estimate,
      confidence:
        modelConfidence != null
          ? Math.min(estimate.confidence, Math.max(0, Math.min(1, modelConfidence)))
          : estimate.confidence,
      needsReview: true,
    };
  } catch {
    return null;
  }
}

export async function analyzeMeal(input: AnalyzeInput): Promise<MacroEstimate | null> {
  if (visionAnalyzer && input.photo) {
    try {
      const result = await visionAnalyzer.analyze(input);
      if (result) return result;
    } catch {
      // fall through
    }
  }
  if (input.photo) {
    const vision = await analyzeWithGemini(input);
    if (vision) return vision;
  }
  return referenceAnalyzer.analyze(input);
}
