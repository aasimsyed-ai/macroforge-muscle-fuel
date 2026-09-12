import type { EstimatedItem } from "@/lib/food-estimate";

/**
 * Looks up a scanned barcode against Open Food Facts — a free, public,
 * no-API-key-required product database. Coverage is genuinely good for
 * packaged/branded goods and weak-to-nonexistent for loose or home-cooked
 * food, which is an accepted, documented limitation rather than a bug:
 * barcode scanning is an optional fast path for packaged items, not a
 * replacement for typed/estimated entry.
 */
const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";

interface OffNutriments {
  "energy-kcal_100g"?: number;
  "energy-kcal_serving"?: number;
  proteins_100g?: number;
  proteins_serving?: number;
  carbohydrates_100g?: number;
  carbohydrates_serving?: number;
  fat_100g?: number;
  fat_serving?: number;
}

interface OffProduct {
  product_name?: string;
  serving_quantity?: number;
  nutriments?: OffNutriments;
}

interface OffResponse {
  status?: number;
  product?: OffProduct;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Returns one EstimatedItem for the scanned product's declared serving size
 * (falling back to 100 g if the product has no serving size on file), or
 * null if the barcode isn't in Open Food Facts or lacks usable nutrition
 * data. Never throws — a lookup failure should always fall back to manual
 * entry, never dead-end the user.
 */
export async function lookupBarcodeProduct(code: string): Promise<EstimatedItem | null> {
  try {
    const res = await fetch(
      `${OFF_BASE}/${encodeURIComponent(code)}.json?fields=product_name,nutriments,serving_quantity`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as OffResponse;
    if (data.status !== 1 || !data.product) return null;

    const { product } = data;
    const nutriments = product.nutriments ?? {};
    const name = product.product_name?.trim();
    if (!name) return null;

    // Prefer the product's own per-serving figures when Open Food Facts has
    // them; otherwise scale the per-100g figures by the declared serving
    // size (or just report per-100g if no serving size is on file at all).
    const servingGrams = product.serving_quantity && product.serving_quantity > 0 ? product.serving_quantity : null;
    const factor = servingGrams ? servingGrams / 100 : 1;

    const calories = nutriments["energy-kcal_serving"] ?? (nutriments["energy-kcal_100g"] ?? 0) * factor;
    const protein = nutriments.proteins_serving ?? (nutriments.proteins_100g ?? 0) * factor;
    const carbs = nutriments.carbohydrates_serving ?? (nutriments.carbohydrates_100g ?? 0) * factor;
    const fat = nutriments.fat_serving ?? (nutriments.fat_100g ?? 0) * factor;

    if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null;

    return {
      label: name,
      grams: servingGrams,
      calories: Math.round(calories),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
      recognised: true,
      exact: true,
    };
  } catch {
    return null;
  }
}
