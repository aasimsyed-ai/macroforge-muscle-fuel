/**
 * Deterministic sanity checks for nutrition numbers. Each threshold is derived
 * from physics or arithmetic — none is a "looks reasonable" range:
 *
 *  - Energy density: fat is the most energy-dense macronutrient at ~9 kcal/g
 *    (Atwater general factor), so no food can exceed ~9 kcal per gram. The 9.05
 *    ceiling only leaves room for rounding.
 *  - Macro mass: protein + carbs + fat cannot weigh more than the food itself
 *    (+1 g for rounding).
 *  - Atwater consistency: 4·P + 4·C + 9·F approximates kcal, but databases use
 *    food-specific factors and fibre/alcohol shift it, so the check allows the
 *    larger of 20% or 10 kcal. Checked against the verified table entries
 *    (cucumber −17%, tomato −14%, almonds +7%, egg +3%); a warning, not an error.
 *  - Recompute: for un-edited table/recipe items the stored numbers must equal
 *    `per-100 g × grams / 100` — this is what catches a duplicated multiplication
 *    or a grams-read-as-servings mistake (rounding tolerance only).
 *  - Portion: a single item above 2 kg is almost always a units mistake
 *    ("100 g egg" read as 100 eggs).
 */
import type { EstimatedItem, NutritionFlag } from "./types";

export const MAX_KCAL_PER_GRAM = 9.05;
export const MAX_PLAUSIBLE_ITEM_GRAMS = 2000;
const ATWATER = { p: 4, c: 4, f: 9 } as const;

export function atwaterKcal(protein: number, carbs: number, fat: number): number {
  return ATWATER.p * protein + ATWATER.c * carbs + ATWATER.f * fat;
}

function finiteNonNegative(...values: number[]): boolean {
  return values.every((v) => Number.isFinite(v) && v >= 0);
}

export function validateItem(item: EstimatedItem): NutritionFlag[] {
  const flags: NutritionFlag[] = [];
  const { calories, protein, carbs, fat, grams } = item;

  if (!finiteNonNegative(calories, protein, carbs, fat)) {
    flags.push({
      code: "invalid_number",
      severity: "error",
      message: `${item.label}: a nutrition value is missing, negative or not a number.`,
    });
    return flags;
  }
  if (item.provenance === "none") return flags;

  if (grams != null && grams > 0) {
    if (calories / grams > MAX_KCAL_PER_GRAM) {
      flags.push({
        code: "energy_density_impossible",
        severity: "error",
        message: `${item.label}: ${calories} kcal in ${grams} g is more energy than pure fat contains (9 kcal per gram).`,
      });
    }
    if (protein + carbs + fat > grams + 1) {
      flags.push({
        code: "macro_mass_exceeds_portion",
        severity: "error",
        message: `${item.label}: the macros add up to more grams than the portion weighs.`,
      });
    }
    if (grams > MAX_PLAUSIBLE_ITEM_GRAMS) {
      flags.push({
        code: "implausible_portion",
        severity: "warn",
        message: `${item.label}: ${Math.round(grams)} g in one item is unusually large — check the amount.`,
      });
    }
  }

  const macroKcal = atwaterKcal(protein, carbs, fat);
  const allowed = Math.max(0.2 * Math.max(calories, macroKcal), 10);
  if (Math.abs(calories - macroKcal) > allowed) {
    flags.push({
      code: "energy_macro_mismatch",
      severity: "warn",
      message: `${item.label}: ${calories} kcal doesn’t match its macros (about ${Math.round(macroKcal)} kcal).`,
    });
  }

  if (
    item.per100g &&
    grams != null &&
    !item.edited &&
    (item.provenance === "database" || item.provenance === "recipe")
  ) {
    const k = grams / 100;
    const off =
      Math.abs(calories - item.per100g.kcal * k) > 1 ||
      Math.abs(protein - item.per100g.p * k) > 0.15 ||
      Math.abs(carbs - item.per100g.c * k) > 0.15 ||
      Math.abs(fat - item.per100g.f * k) > 0.15;
    if (off) {
      flags.push({
        code: "recompute_mismatch",
        severity: "error",
        message: `${item.label}: the numbers don’t match ${grams} g of the reference food.`,
      });
    }
  }
  return flags;
}

export interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function sumItems(items: readonly EstimatedItem[]): Totals {
  return items.reduce<Totals>(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      protein: acc.protein + it.protein,
      carbs: acc.carbs + it.carbs,
      fat: acc.fat + it.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Reported totals must equal the itemized sum (up to float dust). */
export function validateTotals(items: readonly EstimatedItem[], totals: Totals): NutritionFlag[] {
  const sum = sumItems(items);
  const off =
    Math.abs(sum.calories - totals.calories) > 0.5 ||
    Math.abs(sum.protein - totals.protein) > 0.15 ||
    Math.abs(sum.carbs - totals.carbs) > 0.15 ||
    Math.abs(sum.fat - totals.fat) > 0.15;
  return off
    ? [
        {
          code: "totals_mismatch",
          severity: "error",
          message: "The total doesn’t equal the sum of the items.",
        },
      ]
    : [];
}
