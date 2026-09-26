/**
 * Shared types for the food-nutrition pipeline.
 *
 * Numeric authority order (highest first):
 *   label     – a packaged product's own label (barcode lookup)
 *   database  – a generic food from the bundled reference table × a portion
 *   recipe    – a dish calculated from database ingredients (assumed recipe)
 *   estimate  – an AI / photo guess for something the table doesn't know
 *   user      – a number the user typed over one of the above
 *   none      – nothing trustworthy was found; no number is invented
 */
export type NutritionProvenance = "label" | "database" | "recipe" | "estimate" | "user" | "none";

/** How the eaten amount (grams) was arrived at. */
export type PortionBasis = "explicit" | "count" | "household" | "assumed";

export type NutritionFlagCode =
  | "invalid_number"
  | "energy_density_impossible"
  | "macro_mass_exceeds_portion"
  | "energy_macro_mismatch"
  | "recompute_mismatch"
  | "implausible_portion"
  | "totals_mismatch"
  | "no_nutrition_data"
  | "preparation_not_modelled"
  | "compound_reading";

export type NutritionFlag = {
  code: NutritionFlagCode;
  /** "error" = the number should not be trusted; "warn" = worth a second look. */
  severity: "warn" | "error";
  message: string;
};

export type Per100g = { kcal: number; p: number; c: number; f: number };

/** One recognised food within a (possibly multi-item) estimate — for the itemized review UI. */
export type EstimatedItem = {
  label: string;
  /** Grams used for this item, or null when not meaningful. */
  grams: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recognised: boolean;
  /** True for values read from a real product's own label (e.g. a barcode scan) rather than approximated. */
  exact?: boolean;
  provenance?: NutritionProvenance;
  /** Human-readable origin of the numbers, e.g. the reference-table entry or recipe used. */
  sourceNote?: string;
  portionBasis?: PortionBasis;
  /** Things the estimator had to assume (portion size, cooking method, recipe…). */
  assumptions?: string[];
  flags?: NutritionFlag[];
  /** 0-1 — how far this single item's numbers can be trusted. */
  confidence?: number;
  /** Canonical food id, when the item came from the reference table. */
  foodId?: string;
  per100g?: Per100g;
  /** True once the user has typed over any of this item's numbers. */
  edited?: boolean;
};

export type EstimateSource = "reference_table" | "recipe_derived" | "vision_ai" | "unmatched";

export type MacroEstimate = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** 0-1, how confident the estimator is. */
  confidence: number;
  /** Stored on the meal row (`estimate_source`). */
  source: EstimateSource;
  /** Weakest-link provenance across the items that contributed numbers. */
  provenance: NutritionProvenance;
  /** True when something couldn't be resolved or failed a sanity check. */
  needsReview: boolean;
  matchedFood?: string;
  note: string;
  /** Per-item breakdown — always sums to the totals above. */
  items?: EstimatedItem[];
};

export type AnalyzeInput = {
  /** Free-text food description, e.g. "chicken breast with rice + salad". */
  description: string;
  /** Serving size in grams, if the user gave one (applies to a single item). */
  grams?: number | null;
  /** Optional photo — used by a vision analyzer when one is configured. */
  photo?: File | null;
};

export interface FoodAnalyzer {
  readonly id: string;
  analyze(input: AnalyzeInput): Promise<MacroEstimate | null>;
}
