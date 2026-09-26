import type { EstimatedItem } from "@/lib/food-estimate";
import { validateItem } from "@/lib/food/validate";

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
  serving_quantity?: number | string;
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
    // size. With no serving size on file the item is the 100 g the figures
    // describe — stated as such, never presented as an unlabelled serving.
    // (serving_quantity can arrive as a string, so coerce before trusting it.)
    const declared = Number(product.serving_quantity);
    const servingGrams = Number.isFinite(declared) && declared > 0 ? declared : null;
    const basisGrams = servingGrams ?? 100;
    const factor = basisGrams / 100;

    const calories =
      nutriments["energy-kcal_serving"] ?? (nutriments["energy-kcal_100g"] ?? 0) * factor;
    const protein = nutriments.proteins_serving ?? (nutriments.proteins_100g ?? 0) * factor;
    const carbs = nutriments.carbohydrates_serving ?? (nutriments.carbohydrates_100g ?? 0) * factor;
    const fat = nutriments.fat_serving ?? (nutriments.fat_100g ?? 0) * factor;

    if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null;

    const item: EstimatedItem = {
      label: name,
      grams: basisGrams,
      calories: Math.round(calories),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
      recognised: true,
      exact: true,
      provenance: "label",
      sourceNote:
        "Open Food Facts (community-maintained product database) — check against the pack",
      portionBasis: servingGrams ? "explicit" : "assumed",
      assumptions: [
        servingGrams
          ? `Per the ${servingGrams} g serving declared for this product`
          : "No serving size on file — these are the per-100 g figures; change them if you ate a different amount",
      ],
    };
    // Community data has typos (e.g. kcal and kJ swapped) — flag what is physically impossible.
    const flags = validateItem(item);
    const hasError = flags.some((f) => f.severity === "error");
    return {
      ...item,
      ...(flags.length ? { flags } : {}),
      confidence: hasError ? 0.3 : servingGrams ? 0.9 : 0.7,
    };
  } catch {
    return null;
  }
}
