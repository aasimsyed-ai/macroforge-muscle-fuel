import type { EstimatedItem, NutritionProvenance } from "./types";

/** Strength order — a total is only as trustworthy as its weakest counted item. */
const STRENGTH: Record<NutritionProvenance, number> = {
  label: 4,
  database: 3,
  recipe: 2,
  estimate: 1,
  user: 0,
  none: -1,
};

export function provenanceLabel(p: NutritionProvenance): string {
  switch (p) {
    case "label":
      return "Product label";
    case "database":
      return "Database";
    case "recipe":
      return "Recipe-derived";
    case "estimate":
      return "Estimated";
    case "user":
      return "Edited by you";
    case "none":
      return "No data";
  }
}

/** Weakest provenance among items that contributed numbers; "none" if nothing did. */
export function weakestProvenance(items: readonly EstimatedItem[]): NutritionProvenance {
  let weakest: NutritionProvenance | null = null;
  for (const item of items) {
    const p = item.provenance ?? (item.exact ? "label" : "estimate");
    if (p === "none") continue;
    if (weakest === null || STRENGTH[p] < STRENGTH[weakest]) weakest = p;
  }
  return weakest ?? "none";
}

/** Plain-language description of a stored `estimate_source` value (including legacy ones). */
export function describeEstimateSource(source: string | null | undefined): string | null {
  switch (source) {
    case "reference_table":
      return "Calculated from the reference food table";
    case "recipe_derived":
      return "Calculated from an assumed recipe";
    case "vision_ai":
      return "Estimated from a photo";
    case "unmatched":
    case "generic_density":
      return "No matching food found — check the numbers";
    default:
      return null;
  }
}
