/**
 * Food estimation layer.
 *
 * Today this is a transparent, local, per-100g reference estimator. Every value
 * it returns is explicitly labelled as an APPROXIMATE estimate in the UI and is
 * always editable by the user before saving.
 *
 * To plug in a real vision/AI food-analysis backend later, implement the
 * `FoodAnalyzer` interface (e.g. a server function calling a vision model) and
 * pass it to `analyzeMeal`. The rest of the app does not need to change.
 */

export type MacroEstimate = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** 0-1, how confident the estimator is. Photo-only guesses are always low. */
  confidence: number;
  source: "reference_table" | "generic_density" | "vision_ai";
  matchedFood?: string;
  note: string;
};

export type AnalyzeInput = {
  /** Free-text food description, e.g. "grilled chicken breast with rice". */
  description: string;
  /** Serving size in grams, if the user gave one. */
  grams?: number | null;
  /** Optional photo — used by a vision analyzer when one is configured. */
  photo?: File | null;
};

export interface FoodAnalyzer {
  readonly id: string;
  analyze(input: AnalyzeInput): Promise<MacroEstimate | null>;
}

type Ref = { keys: string[]; name: string; kcal: number; p: number; c: number; f: number };

/** Per 100 g reference values (rounded, from common nutrition tables). */
const REFERENCE: Ref[] = [
  { keys: ["chicken breast", "chicken"], name: "Chicken breast", kcal: 165, p: 31, c: 0, f: 3.6 },
  { keys: ["egg white"], name: "Egg white", kcal: 52, p: 11, c: 0.7, f: 0.2 },
  { keys: ["egg", "eggs", "omelette", "omelet"], name: "Whole egg", kcal: 143, p: 13, c: 1.1, f: 9.5 },
  { keys: ["paneer"], name: "Paneer", kcal: 296, p: 20, c: 3.4, f: 22 },
  { keys: ["tofu"], name: "Tofu", kcal: 144, p: 15, c: 3, f: 8 },
  { keys: ["whey", "protein shake", "protein powder"], name: "Whey protein", kcal: 400, p: 78, c: 8, f: 6 },
  { keys: ["greek yogurt", "yoghurt", "yogurt", "curd", "dahi"], name: "Greek yogurt", kcal: 97, p: 9, c: 4, f: 5 },
  { keys: ["milk", "doodh"], name: "Whole milk", kcal: 62, p: 3.3, c: 4.8, f: 3.3 },
  { keys: ["rice", "chawal", "biryani"], name: "Cooked rice", kcal: 130, p: 2.7, c: 28, f: 0.3 },
  { keys: ["roti", "chapati", "phulka"], name: "Roti / chapati", kcal: 297, p: 9, c: 58, f: 3.7 },
  { keys: ["bread", "toast"], name: "Bread", kcal: 265, p: 9, c: 49, f: 3.2 },
  { keys: ["oats", "oatmeal", "porridge"], name: "Oats (dry)", kcal: 379, p: 13, c: 68, f: 6.5 },
  { keys: ["pasta", "noodles", "macaroni"], name: "Cooked pasta", kcal: 158, p: 6, c: 31, f: 0.9 },
  { keys: ["potato", "aloo"], name: "Potato", kcal: 87, p: 2, c: 20, f: 0.1 },
  { keys: ["sweet potato", "shakarkandi"], name: "Sweet potato", kcal: 90, p: 2, c: 21, f: 0.2 },
  { keys: ["dal", "lentil", "dhal", "rajma", "chana", "chickpea"], name: "Cooked lentils / beans", kcal: 116, p: 9, c: 20, f: 0.4 },
  { keys: ["salmon"], name: "Salmon", kcal: 208, p: 20, c: 0, f: 13 },
  { keys: ["tuna"], name: "Tuna", kcal: 132, p: 28, c: 0, f: 1 },
  { keys: ["fish", "machli"], name: "White fish", kcal: 110, p: 23, c: 0, f: 1.5 },
  { keys: ["mutton", "lamb", "goat"], name: "Mutton", kcal: 258, p: 25, c: 0, f: 17 },
  { keys: ["beef", "steak"], name: "Beef", kcal: 250, p: 26, c: 0, f: 15 },
  { keys: ["peanut butter"], name: "Peanut butter", kcal: 588, p: 25, c: 20, f: 50 },
  { keys: ["peanut", "groundnut"], name: "Peanuts", kcal: 567, p: 26, c: 16, f: 49 },
  { keys: ["almond", "badam", "cashew", "walnut", "nuts"], name: "Mixed nuts", kcal: 600, p: 20, c: 20, f: 50 },
  { keys: ["banana", "kela"], name: "Banana", kcal: 89, p: 1.1, c: 23, f: 0.3 },
  { keys: ["apple"], name: "Apple", kcal: 52, p: 0.3, c: 14, f: 0.2 },
  { keys: ["mango"], name: "Mango", kcal: 60, p: 0.8, c: 15, f: 0.4 },
  { keys: ["salad", "vegetable", "veggies", "sabzi", "broccoli", "spinach", "palak"], name: "Vegetables", kcal: 45, p: 2.5, c: 7, f: 0.5 },
  { keys: ["paratha"], name: "Paratha", kcal: 330, p: 7, c: 45, f: 13 },
  { keys: ["dosa", "idli"], name: "Dosa / idli", kcal: 180, p: 5, c: 32, f: 3.5 },
  { keys: ["pizza"], name: "Pizza", kcal: 266, p: 11, c: 33, f: 10 },
  { keys: ["burger"], name: "Burger", kcal: 295, p: 15, c: 27, f: 14 },
  { keys: ["fries", "chips"], name: "Fries", kcal: 312, p: 3.4, c: 41, f: 15 },
  { keys: ["ice cream", "dessert", "cake", "sweet", "mithai"], name: "Dessert", kcal: 350, p: 5, c: 45, f: 17 },
  { keys: ["cheese", "paneer cheese"], name: "Cheese", kcal: 402, p: 25, c: 1.3, f: 33 },
  { keys: ["butter", "ghee", "oil"], name: "Butter / ghee / oil", kcal: 810, p: 0.5, c: 0.5, f: 90 },
  { keys: ["coffee", "tea", "chai"], name: "Tea / coffee with milk", kcal: 40, p: 1.5, c: 5, f: 1.4 },
  { keys: ["soup"], name: "Soup", kcal: 55, p: 3, c: 7, f: 1.5 },
  { keys: ["shake", "smoothie"], name: "Smoothie", kcal: 90, p: 3, c: 15, f: 2 },
];

/** Fallback when nothing in the description is recognised: mixed cooked meal. */
const GENERIC = { name: "Mixed cooked meal", kcal: 150, p: 8, c: 16, f: 6 };

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Deterministic local estimator. Matches every reference food mentioned in the
 * description and averages them, then scales by the serving weight.
 */
export const referenceAnalyzer: FoodAnalyzer = {
  id: "reference_table",
  async analyze({ description, grams }) {
    const text = description.trim().toLowerCase();
    if (!text) return null;

    const matches = REFERENCE.filter((r) => r.keys.some((k) => text.includes(k)));
    const weight = grams && grams > 0 ? grams : 250;

    const base = matches.length
      ? matches.reduce(
          (acc, m) => ({
            kcal: acc.kcal + m.kcal / matches.length,
            p: acc.p + m.p / matches.length,
            c: acc.c + m.c / matches.length,
            f: acc.f + m.f / matches.length,
          }),
          { kcal: 0, p: 0, c: 0, f: 0 },
        )
      : GENERIC;

    const factor = weight / 100;
    const matchedFood = matches.length ? matches.map((m) => m.name).join(" + ") : GENERIC.name;

    return {
      calories: Math.round(base.kcal * factor),
      protein: round1(base.p * factor),
      carbs: round1(base.c * factor),
      fat: round1(base.f * factor),
      confidence: matches.length ? Math.min(0.7, 0.4 + matches.length * 0.1) : 0.25,
      source: matches.length ? "reference_table" : "generic_density",
      matchedFood,
      note: matches.length
        ? `Approximate estimate based on reference values for ${matchedFood} at ${weight} g. Please correct the numbers if your portion differs.`
        : `No exact food match — this is a rough placeholder for a ${weight} g mixed meal. Please correct the numbers.`,
    };
  },
};

/**
 * Optional vision analyzer slot. Wire a real AI food-analysis API here later:
 *
 *   setVisionAnalyzer({ id: "vision_ai", analyze: (input) => callServerFn(input) })
 *
 * Until then photos are stored as-is and macros come from the reference
 * estimator plus your manual corrections.
 */
let visionAnalyzer: FoodAnalyzer | null = null;

export function setVisionAnalyzer(analyzer: FoodAnalyzer | null) {
  visionAnalyzer = analyzer;
}

export function hasVisionAnalyzer(): boolean {
  return visionAnalyzer !== null;
}

export async function analyzeMeal(input: AnalyzeInput): Promise<MacroEstimate | null> {
  if (visionAnalyzer && input.photo) {
    try {
      const result = await visionAnalyzer.analyze(input);
      if (result) return result;
    } catch {
      // fall through to the local estimator
    }
  }
  return referenceAnalyzer.analyze(input);
}

/** Parses "200g", "1.5 cups", "2 rotis" into an approximate gram weight. */
export function parseServingToGrams(serving: string): number | null {
  const s = serving.trim().toLowerCase();
  if (!s) return null;
  const num = parseFloat(s.replace(",", "."));
  if (Number.isNaN(num)) return null;
  if (/kg/.test(s)) return num * 1000;
  if (/(g|gram|gm)\b/.test(s)) return num;
  if (/(ml|l\b|litre|liter)/.test(s)) return /l\b|litre|liter/.test(s) && !/ml/.test(s) ? num * 1000 : num;
  if (/(cup)/.test(s)) return num * 220;
  if (/(bowl)/.test(s)) return num * 250;
  if (/(tbsp|tablespoon)/.test(s)) return num * 15;
  if (/(tsp|teaspoon)/.test(s)) return num * 5;
  if (/(slice|roti|chapati|paratha|piece|pc|egg|scoop|dosa|idli)/.test(s)) {
    if (/scoop/.test(s)) return num * 30;
    if (/egg/.test(s)) return num * 50;
    if (/slice/.test(s)) return num * 30;
    return num * 60;
  }
  if (/(plate|serving)/.test(s)) return num * 350;
  return num > 20 ? num : null;
}
