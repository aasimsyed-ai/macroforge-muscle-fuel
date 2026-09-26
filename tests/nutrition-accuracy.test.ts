import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupBarcodeProduct } from "../src/lib/barcodeLookup";
import { referenceAnalyzer, parseServingToGrams, splitItems } from "../src/lib/food-estimate";
import {
  assembleEstimate,
  estimateFromText,
  findMatches,
  reconcileVisionItems,
} from "../src/lib/food/estimator";
import { FOODS, deriveRecipePer100g, getFood } from "../src/lib/food/foodData";
import { parseQuantity } from "../src/lib/food/portions";
import { describeEstimateSource, weakestProvenance } from "../src/lib/food/provenance";
import type { EstimatedItem } from "../src/lib/food/types";
import { sumItems, validateItem, validateTotals } from "../src/lib/food/validate";

const FAILING_INPUT = "3 boiled eggs + 150 g biryani + cucumber";

/** Independent expectation: per-100 g × grams / 100, straight from the table. */
function expected(id: string, grams: number) {
  const food = getFood(id);
  if (!food) throw new Error(`no food ${id}`);
  const k = grams / 100;
  return {
    calories: Math.round(food.per100g.kcal * k),
    protein: Math.round(food.per100g.p * k * 10) / 10,
    carbs: Math.round(food.per100g.c * k * 10) / 10,
    fat: Math.round(food.per100g.f * k * 10) / 10,
  };
}

function est(text: string, grams: number | null = null) {
  const result = estimateFromText(text, grams);
  if (!result) throw new Error(`no estimate for "${text}"`);
  return result;
}

function item(over: Partial<EstimatedItem> = {}): EstimatedItem {
  return {
    label: "Test food",
    grams: 100,
    calories: 100,
    protein: 5,
    carbs: 15,
    fat: 2,
    recognised: true,
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("A. 3 boiled eggs + 150 g biryani + cucumber (the reported failure)", () => {
  const result = est(FAILING_INPUT);
  const [egg, biryani, cucumber] = result.items ?? [];

  it("keeps each component separate and traceable", () => {
    expect(result.items).toHaveLength(3);
    expect(egg?.foodId).toBe("egg_boiled");
    expect(biryani?.foodId).toBe("biryani_chicken");
    expect(cucumber?.foodId).toBe("cucumber");
  });

  it("3 boiled eggs = 3 × 50 g at the boiled-egg reference, not a generic value", () => {
    expect(egg?.grams).toBe(150);
    expect(egg?.portionBasis).toBe("count");
    expect(egg).toMatchObject(expected("egg_boiled", 150));
    expect(egg?.calories).toBe(233);
  });

  it("150 g biryani is a recipe-derived dish, not plain cooked rice", () => {
    expect(biryani?.grams).toBe(150);
    expect(biryani?.provenance).toBe("recipe");
    expect(biryani).toMatchObject(expected("biryani_chicken", 150));
    expect(biryani?.label).not.toBe("Rice, cooked");
    // The biryani is fatter than plain rice at the same weight (ghee/chicken in the recipe).
    expect(biryani?.fat ?? 0).toBeGreaterThan(expected("rice_cooked", 150).fat * 5);
  });

  it("cucumber is a real ~15 kcal/100 g food, not the old 225 kcal generic fallback", () => {
    expect(cucumber?.grams).toBe(100);
    expect(cucumber?.portionBasis).toBe("assumed");
    expect(cucumber).toMatchObject(expected("cucumber", 100));
    expect(cucumber?.calories).toBe(15);
    expect(cucumber?.carbs ?? 99).toBeLessThan(5);
    expect(cucumber?.fat ?? 99).toBeLessThan(1);
  });

  it("the total equals the itemized sum and is far below the old 635 kcal", () => {
    const sum = sumItems(result.items ?? []);
    expect(result.calories).toBe(sum.calories);
    expect(result.protein).toBeCloseTo(sum.protein, 5);
    expect(result.carbs).toBeCloseTo(sum.carbs, 5);
    expect(result.fat).toBeCloseTo(sum.fat, 5);
    expect(result.calories).toBe(233 + expected("biryani_chicken", 150).calories + 15);
    expect(result.calories).toBeLessThan(560);
  });

  it("retains provenance: USDA-backed egg, recipe biryani, assumed cucumber portion", () => {
    expect(egg?.provenance).toBe("database");
    expect(egg?.sourceNote).toContain("USDA FoodData Central #173424");
    expect(cucumber?.sourceNote).toContain("USDA FoodData Central #168409");
    expect(biryani?.sourceNote).toContain("Recipe-derived");
    expect(cucumber?.assumptions?.join(" ")).toMatch(/Assumed 100 g/);
    expect(result.provenance).toBe("recipe");
    expect(result.source).toBe("recipe_derived");
  });

  it("no item carries a validation error", () => {
    for (const it of result.items ?? []) {
      expect(it.flags?.filter((f) => f.severity === "error") ?? []).toEqual([]);
    }
  });
});

describe("B–D. single foods", () => {
  it("B. 150 g cucumber", () => {
    const r = est("150 g cucumber");
    expect(r.items).toHaveLength(1);
    expect(r.items?.[0]).toMatchObject(expected("cucumber", 150));
    expect(r.calories).toBe(23);
  });

  it("C. 1 boiled egg", () => {
    const r = est("1 boiled egg");
    expect(r.items?.[0]?.grams).toBe(50);
    expect(r).toMatchObject(expected("egg_boiled", 50));
  });

  it("D. 150 g cooked rice", () => {
    const r = est("150 g cooked rice");
    expect(r).toMatchObject(expected("rice_cooked", 150));
    expect(r.calories).toBe(195);
    expect(r.items?.[0]?.provenance).toBe("database");
  });
});

describe("E. same input, different user contexts", () => {
  it("returns identical numbers regardless of who is signed in, locale or time", () => {
    const random = vi.spyOn(Math, "random");
    const now = vi.spyOn(Date, "now");

    vi.stubGlobal("navigator", { language: "en-IN", userAgent: "user-a" });
    vi.stubGlobal("localStorage", { getItem: () => "user-a-profile-goal-cut" });
    const userA = estimateFromText(FAILING_INPUT, null);

    vi.stubGlobal("navigator", { language: "en-US", userAgent: "user-b" });
    vi.stubGlobal("localStorage", { getItem: () => "user-b-profile-goal-bulk" });
    const userB = estimateFromText(FAILING_INPUT, null);

    expect(userB).toEqual(userA);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it("the async analyzer used by the app agrees with the pure function", async () => {
    const viaAnalyzer = await referenceAnalyzer.analyze({ description: FAILING_INPUT });
    expect(viaAnalyzer).toEqual(estimateFromText(FAILING_INPUT, null));
  });

  it("casing and spacing of the same words do not change the result", () => {
    const a = est("3 Boiled Eggs + 150g Biryani + Cucumber");
    const b = est(FAILING_INPUT);
    expect(a.calories).toBe(b.calories);
    expect(a.protein).toBe(b.protein);
  });

  it("the estimation modules never read user, locale, storage, time or randomness", () => {
    const dir = join(__dirname, "..", "src", "lib", "food");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(3);
    const forbidden =
      /supabase|useAuth|use-auth|localStorage|sessionStorage|navigator\.|Intl\.|toLocale|Math\.random|Date\.now|new Date|process\.env|import\.meta/;
    for (const file of files) {
      const code = readFileSync(join(dir, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(code, file).not.toMatch(forbidden);
    }
  });
});

describe("F. portions scale linearly and deterministically", () => {
  for (const [text, id] of [
    ["cucumber", "cucumber"],
    ["cooked rice", "rice_cooked"],
    ["boiled egg", "egg_boiled"],
    ["chicken biryani", "biryani_chicken"],
  ] as const) {
    it(`${text} at 100 / 150 / 200 g follows per-100 g × grams / 100`, () => {
      const results = [100, 150, 200].map((g) => est(`${g} g ${text}`));
      [100, 150, 200].forEach((g, i) => {
        expect(results[i]).toMatchObject(expected(id, g));
        expect(results[i]?.items?.[0]?.grams).toBe(g);
      });
      // no duplicated multiplication: doubling the grams doubles the energy (± rounding)
      const one = results[0]?.calories ?? 0;
      const two = results[2]?.calories ?? 0;
      expect(Math.abs(two - 2 * one)).toBeLessThanOrEqual(1);
    });
  }

  it("the Serving amount field is honoured for a single item", () => {
    expect(est("cucumber", 200)).toMatchObject(expected("cucumber", 200));
  });

  it("an explicit weight in the text beats the Serving amount field", () => {
    expect(est("150 g cucumber", 400)).toMatchObject(expected("cucumber", 150));
  });
});

describe("G. branded barcode food", () => {
  function mockFetchOnce(body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }),
    );
  }

  it("keeps the product's own label values and labels them as such", async () => {
    mockFetchOnce({
      status: 1,
      product: {
        product_name: "Acme Protein Bar",
        serving_quantity: 60,
        nutriments: {
          "energy-kcal_serving": 210,
          proteins_serving: 20,
          carbohydrates_serving: 18,
          fat_serving: 7,
        },
      },
    });
    const bar = await lookupBarcodeProduct("8901234567890");
    expect(bar).toMatchObject({
      label: "Acme Protein Bar",
      calories: 210,
      protein: 20,
      carbs: 18,
      fat: 7,
      exact: true,
      provenance: "label",
      grams: 60,
    });
    expect(bar?.sourceNote).toContain("Open Food Facts");
    // never silently swapped for a generic table entry
    expect(bar?.foodId).toBeUndefined();
    expect(bar?.label).not.toBe(getFood("whey")?.name);
  });

  it("a label item added beside typed foods keeps its provenance in the total", () => {
    const label: EstimatedItem = item({
      label: "Acme Protein Bar",
      grams: 60,
      calories: 210,
      protein: 20,
      carbs: 18,
      fat: 7,
      provenance: "label",
      exact: true,
    });
    const typed = est("1 boiled egg").items ?? [];
    const combined = assembleEstimate([...typed, label]);
    expect(combined.calories).toBe(78 + 210);
    expect(combined.provenance).toBe("database");
    expect(weakestProvenance([label])).toBe("label");
  });

  it("with no serving size the item is stated as 100 g, not an unlabelled serving", async () => {
    mockFetchOnce({
      status: 1,
      product: {
        product_name: "Loose Biscuit",
        nutriments: {
          "energy-kcal_100g": 480,
          proteins_100g: 6,
          carbohydrates_100g: 70,
          fat_100g: 20,
        },
      },
    });
    const biscuit = await lookupBarcodeProduct("1");
    expect(biscuit?.grams).toBe(100);
    expect(biscuit?.calories).toBe(480);
    expect(biscuit?.portionBasis).toBe("assumed");
    expect(biscuit?.assumptions?.join(" ")).toMatch(/per-100 g/);
  });

  it("accepts a serving_quantity delivered as a string", async () => {
    mockFetchOnce({
      status: 1,
      product: {
        product_name: "String Serving",
        serving_quantity: "30",
        nutriments: {
          "energy-kcal_100g": 400,
          proteins_100g: 10,
          carbohydrates_100g: 60,
          fat_100g: 12,
        },
      },
    });
    const p = await lookupBarcodeProduct("2");
    expect(p?.grams).toBe(30);
    expect(p?.calories).toBe(120);
  });

  it("flags physically impossible label data instead of trusting it", async () => {
    mockFetchOnce({
      status: 1,
      product: {
        product_name: "Typo Snack",
        serving_quantity: 30,
        nutriments: {
          "energy-kcal_serving": 2500,
          proteins_serving: 2,
          carbohydrates_serving: 10,
          fat_serving: 3,
        },
      },
    });
    const snack = await lookupBarcodeProduct("3");
    expect(snack?.flags?.some((f) => f.code === "energy_density_impossible")).toBe(true);
    expect(snack?.confidence ?? 1).toBeLessThan(0.5);
  });
});

describe("H. homemade composite meal", () => {
  const meal = est("2 rotis + 100 g dal + 150 g chicken biryani + salad");
  const items = meal.items ?? [];

  it("every component stays a separate, traceable line", () => {
    expect(items.map((i) => i.foodId)).toEqual([
      "roti",
      "lentils_cooked",
      "biryani_chicken",
      "salad",
    ]);
  });

  it("count, explicit and assumed portions are each resolved as such", () => {
    expect(items.map((i) => i.portionBasis)).toEqual(["count", "explicit", "explicit", "assumed"]);
    expect(items[0]?.grams).toBe(90);
    expect(items[1]?.grams).toBe(100);
    expect(items[2]?.grams).toBe(150);
    expect(items[3]?.grams).toBe(100);
  });

  it("totals equal the itemized sums for calories and every macro", () => {
    const sum = sumItems(items);
    expect(meal.calories).toBe(sum.calories);
    expect(meal.protein).toBeCloseTo(sum.protein, 5);
    expect(meal.carbs).toBeCloseTo(sum.carbs, 5);
    expect(meal.fat).toBeCloseTo(sum.fat, 5);
    expect(validateTotals(items, meal)).toEqual([]);
  });

  it("recipe dishes are recipe-derived and the meal is only as strong as its weakest part", () => {
    expect(items[2]?.provenance).toBe("recipe");
    expect(items[3]?.provenance).toBe("recipe");
    expect(meal.provenance).toBe("recipe");
  });
});

describe("root-cause regressions (each was a real defect)", () => {
  it("unknown foods are NOT given an invented value", () => {
    const r = est("xyzfoodnotreal");
    expect(r.items?.[0]).toMatchObject({
      recognised: false,
      provenance: "none",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(r.calories).toBe(0);
    expect(r.needsReview).toBe(true);
    expect(r.source).toBe("unmatched");
    expect(r.items?.[0]?.flags?.[0]?.code).toBe("no_nutrition_data");
  });

  it("an unknown item beside a known one is left out of the total, and says so", () => {
    const r = est("1 boiled egg + zzzunknownfood");
    expect(r.calories).toBe(78);
    expect(r.needsReview).toBe(true);
    expect(r.note).toContain("zzzunknownfood");
    expect(r.confidence).toBeLessThan(est("1 boiled egg").confidence);
  });

  it("'boiled' no longer matches 'oil' (was adding ~80 kcal of oil to every boiled food)", () => {
    const tokens = "boiled rice".split(" ");
    expect(findMatches(tokens).map((m) => m.food.id)).toEqual(["rice_cooked"]);
    expect(est("boiled potato").items?.map((i) => i.foodId)).toEqual(["potato"]);
    expect(est("boiled chicken").items?.map((i) => i.foodId)).toEqual(["chicken_meat"]);
  });

  it("input that is only separators yields no estimate (no phantom 0 kcal result)", () => {
    expect(estimateFromText("+", null)).toBeNull();
    expect(estimateFromText(" , ; ", null)).toBeNull();
    expect(estimateFromText("   ", null)).toBeNull();
  });

  it("an absurd portion asks for review, not just a quiet warning", () => {
    const r = est("10000 g rice");
    expect(r.items?.[0]?.flags?.map((f) => f.code)).toContain("implausible_portion");
    expect(r.needsReview).toBe(true);
    expect(est("150 g cooked rice").needsReview).toBe(false);
  });

  it("'eggplant' is not an egg", () => {
    expect(est("eggplant").items?.map((i) => i.foodId)).toEqual(["eggplant"]);
  });

  it("'100 g egg' is 100 g, not 100 eggs (5,000 g)", () => {
    expect(parseServingToGrams("100 g egg")).toBe(100);
    const r = est("100 g egg");
    expect(r.items?.[0]?.grams).toBe(100);
    expect(r.calories).toBe(155);
  });

  it("'150 g roti' is 150 g, not 150 rotis", () => {
    expect(est("150 g roti").items?.[0]?.grams).toBe(150);
  });

  it("fractions are not split apart: '1/2 cup rice' is 100 g, not two items", () => {
    expect(splitItems("1/2 cup rice")).toEqual(["1/2 cup rice"]);
    const r = est("1/2 cup rice");
    expect(r.items).toHaveLength(1);
    expect(r.items?.[0]?.grams).toBe(100);
    expect(est("½ cup rice").items?.[0]?.grams).toBe(100);
    expect(est("1 1/2 cup rice").items?.[0]?.grams).toBe(300);
  });

  it("countable foods use their unit weight: '2 bananas' is two bananas, not one", () => {
    expect(est("2 bananas").items?.[0]?.grams).toBe(236);
    expect(est("2 bananas").calories).toBe(expected("banana", 236).calories);
  });

  it("an explicit weight on a dry food is literal (was silently replaced by 45 g)", () => {
    const r = est("200 g whey");
    expect(r.items).toHaveLength(1);
    expect(r.items?.[0]?.grams).toBe(200);
    expect(r).toMatchObject(expected("whey", 200));
  });

  it("whey no longer gets 200 ml of milk added without being asked", () => {
    const r = est("1 scoop whey");
    expect(r.items).toHaveLength(1);
    expect(r.calories).toBe(expected("whey", 30).calories);
  });

  it("a bowl of dry cereal is still 45 g dry plus an explicit, removable milk line", () => {
    const r = est("1 bowl cornflakes");
    expect(r.items?.map((i) => i.foodId)).toEqual(["cereal", "milk"]);
    expect(r.items?.[0]?.grams).toBe(45);
    expect(r.items?.[1]?.assumptions?.join(" ")).toMatch(/remove this line/);
  });

  it("curd is plain yogurt, not Greek yogurt", () => {
    expect(est("curd").items?.[0]?.foodId).toBe("yogurt_plain");
    expect(est("greek yogurt").items?.[0]?.foodId).toBe("greek_yogurt");
  });

  it("a quantity for several foods in one phrase is shared, never multiplied per food", () => {
    const r = est("150 g chicken with rice");
    expect(r.items).toHaveLength(2);
    const grams = (r.items ?? []).reduce((s, i) => s + (i.grams ?? 0), 0);
    expect(Math.abs(grams - 150)).toBeLessThan(0.3);
  });

  it("cooked-dish wording is flagged instead of silently treated as the plain ingredient", () => {
    const r = est("fried rice");
    expect(r.items?.[0]?.flags?.some((f) => f.code === "preparation_not_modelled")).toBe(true);
    expect(r.needsReview).toBe(true);
    expect(est("chicken curry").items?.[0]?.flags?.map((f) => f.code)).toContain(
      "preparation_not_modelled",
    );
  });

  it("an ambiguous compound name is flagged for review", () => {
    const r = est("aloo paratha");
    expect(r.items?.every((i) => i.flags?.some((f) => f.code === "compound_reading"))).toBe(true);
    expect(r.needsReview).toBe(true);
  });

  it("ambiguous words state what was assumed (egg → boiled, oats → cooked, biryani → chicken)", () => {
    expect(est("egg").items?.[0]?.assumptions?.join(" ")).toMatch(/Assumed boiled/);
    expect(est("oats").items?.[0]?.assumptions?.join(" ")).toMatch(/cooked porridge/);
    expect(est("biryani").items?.[0]?.assumptions?.join(" ")).toMatch(/Assumed chicken biryani/);
  });
});

describe("parser", () => {
  it("prefers an explicit weight over a household word", () => {
    expect(parseQuantity("1 bowl (250 g)").grams).toBe(250);
    expect(parseQuantity("1 cup 180 g rice").grams).toBe(180);
  });

  it("reads kg, ml and litres", () => {
    expect(parseQuantity("1.5 kg").grams).toBe(1500);
    expect(parseQuantity("250 ml milk").grams).toBe(250);
    expect(parseQuantity("1 litre").grams).toBe(1000);
  });

  it("household measures, with counts and number words", () => {
    expect(parseQuantity("2 tbsp").grams).toBe(30);
    expect(parseQuantity("two bowls").grams).toBe(500);
    expect(parseQuantity("half a cup").grams).toBe(100);
    expect(parseQuantity("a glass").grams).toBe(200);
  });

  it("a bare small number is a count for the caller, a bare large one is grams", () => {
    expect(parseQuantity("3 boiled eggs")).toMatchObject({ grams: null, count: 3 });
    expect(parseQuantity("150 rice")).toMatchObject({ grams: 150, basis: "explicit" });
  });

  it("splits on +, comma, 'and', ' / ' and & but not inside numbers", () => {
    expect(splitItems("2 eggs + toast, banana and tea & milk")).toEqual([
      "2 eggs",
      "toast",
      "banana",
      "tea",
      "milk",
    ]);
    expect(splitItems("1,5 cup rice")).toEqual(["1,5 cup rice"]);
    expect(splitItems("rice / dal")).toEqual(["rice", "dal"]);
  });

  it("the serving-field helper keeps its legacy behaviour", () => {
    expect(parseServingToGrams("200g")).toBe(200);
    expect(parseServingToGrams("1 bowl")).toBe(250);
    expect(parseServingToGrams("2 rotis")).toBe(110);
    expect(parseServingToGrams("2 eggs")).toBe(100);
    expect(parseServingToGrams("")).toBeNull();
    expect(parseServingToGrams("some rice")).toBeNull();
  });
});

describe("sanity / impossibility checks", () => {
  it("flags energy above what pure fat can supply (9 kcal/g)", () => {
    const flags = validateItem(item({ grams: 50, calories: 900, protein: 0, carbs: 0, fat: 50 }));
    expect(flags.map((f) => f.code)).toContain("energy_density_impossible");
  });

  it("does not flag pure fat itself", () => {
    const flags = validateItem(item({ grams: 100, calories: 884, protein: 0, carbs: 0, fat: 100 }));
    expect(flags.filter((f) => f.severity === "error")).toEqual([]);
  });

  it("flags macros that outweigh the portion", () => {
    const flags = validateItem(item({ grams: 20, calories: 100, protein: 15, carbs: 15, fat: 10 }));
    expect(flags.map((f) => f.code)).toContain("macro_mass_exceeds_portion");
  });

  it("flags negative and non-finite numbers", () => {
    expect(validateItem(item({ calories: -5 }))[0]?.code).toBe("invalid_number");
    expect(validateItem(item({ protein: Number.NaN }))[0]?.code).toBe("invalid_number");
  });

  it("flags calories that disagree with the macros (Atwater)", () => {
    const flags = validateItem(item({ grams: 100, calories: 400, protein: 5, carbs: 10, fat: 2 }));
    expect(flags.map((f) => f.code)).toContain("energy_macro_mismatch");
  });

  it("tolerates the real database conventions (fibre-rich vegetables, oils, nuts)", () => {
    for (const id of ["cucumber", "tomato", "ghee", "mixed_nuts", "sweet_corn", "pomegranate"]) {
      const food = getFood(id);
      const flags = validateItem(
        item({
          grams: 100,
          calories: food?.per100g.kcal ?? 0,
          protein: food?.per100g.p ?? 0,
          carbs: food?.per100g.c ?? 0,
          fat: food?.per100g.f ?? 0,
        }),
      );
      expect(flags, id).toEqual([]);
    }
  });

  it("catches a duplicated multiplication in a table-derived item", () => {
    const good = est("150 g cucumber").items?.[0] as EstimatedItem;
    expect(validateItem(good)).toEqual([]);
    const doubled: EstimatedItem = { ...good, calories: good.calories * 2 };
    expect(validateItem(doubled).map((f) => f.code)).toContain("recompute_mismatch");
  });

  it("catches grams read as servings (a 100 g item that is 100× too heavy)", () => {
    const good = est("100 g cooked rice").items?.[0] as EstimatedItem;
    const wrong: EstimatedItem = { ...good, grams: 10000, calories: good.calories * 100 };
    const codes = validateItem(wrong).map((f) => f.code);
    expect(codes).toContain("implausible_portion");
    expect(codes).toContain("recompute_mismatch");
  });

  it("does not apply the recompute check once the user has edited the item", () => {
    const good = est("150 g cucumber").items?.[0] as EstimatedItem;
    const edited: EstimatedItem = { ...good, calories: 40, edited: true, provenance: "user" };
    expect(validateItem(edited).map((f) => f.code)).not.toContain("recompute_mismatch");
  });

  it("flags totals that do not equal the itemized sum", () => {
    const items = est("1 boiled egg + 150 g cooked rice").items ?? [];
    const sum = sumItems(items);
    expect(validateTotals(items, sum)).toEqual([]);
    expect(validateTotals(items, { ...sum, calories: sum.calories + 50 })[0]?.code).toBe(
      "totals_mismatch",
    );
  });

  it("a failed check lowers confidence and asks for review instead of passing silently", () => {
    const clean = assembleEstimate([est("150 g cooked rice").items?.[0] as EstimatedItem]);
    const bad = assembleEstimate([
      item({
        label: "Mystery",
        grams: 30,
        calories: 2500,
        protein: 2,
        carbs: 10,
        fat: 3,
        provenance: "estimate",
        confidence: 0.35,
        flags: validateItem(
          item({
            grams: 30,
            calories: 2500,
            protein: 2,
            carbs: 10,
            fat: 3,
            provenance: "estimate",
          }),
        ),
      }),
    ]);
    expect(bad.needsReview).toBe(true);
    expect(bad.confidence).toBeLessThan(clean.confidence);
  });
});

describe("photo estimates: the model identifies, the table calculates", () => {
  it("recomputes a recognised food from the table using the model's portion guess", () => {
    const [egg] = reconcileVisionItems([
      { name: "Boiled egg", portion_g: 100, calories: 999, protein_g: 99, carbs_g: 99, fat_g: 99 },
    ]);
    expect(egg).toMatchObject(expected("egg_boiled", 100));
    expect(egg?.provenance).toBe("database");
    expect(egg?.portionBasis).toBe("assumed");
    expect((egg?.confidence ?? 1) <= 0.55).toBe(true);
  });

  it("keeps the model's numbers only for unknown foods, labelled Estimated", () => {
    const [mystery] = reconcileVisionItems([
      {
        name: "Zorblax surprise",
        portion_g: 200,
        calories: 300,
        protein_g: 10,
        carbs_g: 30,
        fat_g: 15,
      },
    ]);
    expect(mystery).toMatchObject({ calories: 300, provenance: "estimate", grams: 200 });
  });

  it("flags impossible model output for an unknown food", () => {
    const [bad] = reconcileVisionItems([
      {
        name: "Zorblax surprise",
        portion_g: 50,
        calories: 900,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 10,
      },
    ]);
    expect(bad?.flags?.some((f) => f.code === "energy_density_impossible")).toBe(true);
  });

  it("never reports a photo estimate as high-confidence", () => {
    const est1 = assembleEstimate(
      reconcileVisionItems([
        { name: "cucumber", portion_g: 120 },
        { name: "rice", portion_g: 150 },
      ]),
      { source: "vision_ai", confidenceCap: 0.6 },
    );
    expect(est1.confidence).toBeLessThanOrEqual(0.6);
    expect(est1.source).toBe("vision_ai");
    expect(est1.provenance).toBe("database");
  });
});

describe("reference table integrity", () => {
  it("every food has aliases, positive per-100 g energy consistency and a source tag", () => {
    for (const food of FOODS) {
      expect(food.aliases.length, food.id).toBeGreaterThan(0);
      const flags = validateItem({
        label: food.name,
        grams: food.defaultPortionG,
        calories: Math.round((food.per100g.kcal * food.defaultPortionG) / 100),
        protein: (food.per100g.p * food.defaultPortionG) / 100,
        carbs: (food.per100g.c * food.defaultPortionG) / 100,
        fat: (food.per100g.f * food.defaultPortionG) / 100,
        recognised: true,
        provenance: "database",
      });
      expect(
        flags.filter((f) => f.severity === "error"),
        food.id,
      ).toEqual([]);
      expect(["usda", "curated", "recipe"]).toContain(food.source.kind);
    }
  });

  it("ids and aliases are unique (an alias must never point at two foods)", () => {
    const ids = FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const seen = new Map<string, string>();
    for (const food of FOODS) {
      for (const alias of food.aliases) {
        const key = alias.toLowerCase();
        expect(seen.has(key) ? `${key} in ${seen.get(key)} and ${food.id}` : "ok").toBe("ok");
        seen.set(key, food.id);
      }
    }
  });

  it("USDA-tagged entries carry a record id; the verified values are the ones checked against FDC", () => {
    const verified: Record<string, [number, number, number, number, number]> = {
      egg_boiled: [173424, 155, 12.6, 1.12, 10.6],
      egg_fried: [173423, 196, 13.6, 0.83, 14.8],
      chicken_breast: [171477, 165, 31, 0, 3.57],
      chicken_meat: [171054, 190, 28.9, 0, 7.41],
      rice_cooked: [168878, 130, 2.69, 28.2, 0.28],
      lentils_cooked: [172421, 116, 9.02, 20.1, 0.38],
      cucumber: [168409, 15, 0.65, 3.63, 0.11],
      tomato: [170457, 18, 0.88, 3.89, 0.2],
      onion: [170000, 40, 1.1, 9.34, 0.1],
      ghee: [173412, 876, 0.28, 0, 99.5],
    };
    for (const [id, [fdcId, kcal, p, c, f]] of Object.entries(verified)) {
      const food = getFood(id);
      expect(food?.source, id).toMatchObject({ kind: "usda", fdcId });
      expect(food?.per100g, id).toEqual({ kcal, p, c, f });
    }
    for (const food of FOODS) {
      if (food.source.kind === "usda") expect(food.source.fdcId).toBeGreaterThan(0);
    }
  });

  it("a recipe's per-100 g values are the plain weighted sum of its ingredients", () => {
    const biryani = getFood("biryani_chicken");
    expect(biryani?.recipe?.reduce((s, c) => s + c.grams, 0)).toBe(100);
    const byId = new Map(FOODS.map((f) => [f.id, f]));
    const derived = deriveRecipePer100g(biryani?.recipe ?? [], byId);
    expect(biryani?.per100g).toEqual(derived);
    // hand-check: 60 g rice + 20 g chicken + 6 g ghee + 8 g onion + 4 g tomato + water
    const kcal = 0.6 * 130 + 0.2 * 190 + 0.06 * 876 + 0.08 * 40 + 0.04 * 18;
    expect(derived.kcal).toBeCloseTo(kcal, 1);
  });

  it("every recipe stays within energy-density and Atwater sanity", () => {
    for (const food of FOODS.filter((f) => f.recipe)) {
      const flags = validateItem({
        label: food.name,
        grams: 100,
        calories: food.per100g.kcal,
        protein: food.per100g.p,
        carbs: food.per100g.c,
        fat: food.per100g.f,
        recognised: true,
        provenance: "database",
      });
      expect(flags, food.id).toEqual([]);
    }
  });
});

describe("provenance helpers", () => {
  it("describes stored estimate sources, including the legacy value", () => {
    expect(describeEstimateSource("reference_table")).toMatch(/reference food table/);
    expect(describeEstimateSource("recipe_derived")).toMatch(/recipe/);
    expect(describeEstimateSource("vision_ai")).toMatch(/photo/);
    expect(describeEstimateSource("generic_density")).toMatch(/No matching food/);
    expect(describeEstimateSource(null)).toBeNull();
  });

  it("the weakest counted item decides a total's provenance; unmatched items don't count", () => {
    expect(weakestProvenance([item({ provenance: "label" }), item({ provenance: "recipe" })])).toBe(
      "recipe",
    );
    expect(weakestProvenance([item({ provenance: "none" })])).toBe("none");
    expect(
      weakestProvenance([item({ provenance: "database" }), item({ provenance: "none" })]),
    ).toBe("database");
  });
});
