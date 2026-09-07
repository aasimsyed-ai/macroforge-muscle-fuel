/**
 * Food estimation layer.
 *
 * A transparent, local, per-100 g reference estimator. Every value it returns is
 * labelled APPROXIMATE in the UI and stays editable before saving.
 *
 * It handles a few things people actually type:
 *  - multi-item meals separated by "+", "," or "and" — each item is estimated
 *    with its own sensible portion and the results are summed;
 *  - the most specific phrase wins ("protein oats" over plain "oats");
 *  - dry pantry items (cereal, rolled oats, whey) served in a bowl are treated
 *    as a small dry amount plus milk;
 *  - "... with milk" / "cooked in milk" adds milk.
 *
 * For real context awareness (exact macros for a named product) wire an AI
 * analyzer into the `visionAnalyzer` slot below — nothing else needs to change.
 */

export type MacroEstimate = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** 0-1, how confident the estimator is. */
  confidence: number;
  source: "reference_table" | "generic_density" | "vision_ai";
  matchedFood?: string;
  note: string;
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

type Ref = {
  keys: string[];
  name: string;
  /** Per 100 g, as eaten. */
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** Typical eaten amount in grams, used when no explicit portion is given. */
  serve: number;
  /**
   * Dry pantry item (cereal, rolled oats, whey…). Served in a container it is
   * treated as ~45 g dry + milk rather than a full bowl of the dry food.
   */
  dry?: boolean;
};

const REFERENCE: Ref[] = [
  { keys: ["chicken breast", "grilled chicken", "chicken"], name: "Chicken breast", kcal: 165, p: 31, c: 0, f: 3.6, serve: 150 },
  { keys: ["egg white"], name: "Egg white", kcal: 52, p: 11, c: 0.7, f: 0.2, serve: 66 },
  { keys: ["boiled egg", "egg", "eggs", "omelette", "omelet", "anda"], name: "Whole egg", kcal: 143, p: 13, c: 1.1, f: 9.5, serve: 100 },
  { keys: ["paneer"], name: "Paneer", kcal: 296, p: 20, c: 3.4, f: 22, serve: 60 },
  { keys: ["tofu"], name: "Tofu", kcal: 144, p: 15, c: 3, f: 8, serve: 100 },
  { keys: ["whey", "protein shake", "protein powder", "mass gainer"], name: "Whey protein", kcal: 400, p: 78, c: 8, f: 6, serve: 30, dry: true },
  { keys: ["greek yogurt", "yoghurt", "yogurt", "curd", "dahi"], name: "Greek yogurt", kcal: 97, p: 9, c: 4, f: 5, serve: 150 },
  { keys: ["milk", "doodh"], name: "Milk", kcal: 62, p: 3.3, c: 4.8, f: 3.3, serve: 200 },
  { keys: ["rice", "chawal", "biryani", "pulao", "khichdi", "fried rice"], name: "Cooked rice", kcal: 130, p: 2.7, c: 28, f: 0.3, serve: 180 },
  { keys: ["roti", "chapati", "phulka"], name: "Roti / chapati", kcal: 297, p: 9, c: 58, f: 3.7, serve: 45 },
  { keys: ["bread", "toast"], name: "Bread", kcal: 265, p: 9, c: 49, f: 3.2, serve: 60 },
  {
    keys: ["protein oats", "protein muesli", "flavoured oats", "flavored oats", "chocolate oats", "yogabar", "yoga bar", "oats shake"],
    name: "Flavoured protein oats with milk",
    kcal: 120,
    p: 6,
    c: 15,
    f: 3.5,
    serve: 250,
  },
  { keys: ["rolled oats", "raw oats", "dry oats", "oats dry", "overnight oats"], name: "Rolled oats", kcal: 379, p: 13, c: 67, f: 6.5, serve: 40, dry: true },
  { keys: ["granola", "muesli"], name: "Granola / muesli", kcal: 450, p: 10, c: 64, f: 15, serve: 45, dry: true },
  { keys: ["oats", "oatmeal", "porridge", "dalia", "daliya"], name: "Oats porridge, cooked", kcal: 95, p: 3.6, c: 15, f: 2.4, serve: 250 },
  { keys: ["cornflakes", "corn flakes", "cereal"], name: "Breakfast cereal", kcal: 378, p: 7, c: 84, f: 1, serve: 40, dry: true },
  { keys: ["pasta", "noodles", "macaroni", "maggi"], name: "Cooked pasta / noodles", kcal: 158, p: 6, c: 31, f: 0.9, serve: 180 },
  { keys: ["potato", "aloo"], name: "Potato", kcal: 87, p: 2, c: 20, f: 0.1, serve: 150 },
  { keys: ["sweet potato", "shakarkandi"], name: "Sweet potato", kcal: 90, p: 2, c: 21, f: 0.2, serve: 150 },
  { keys: ["dal", "lentil", "dhal", "rajma", "chana", "chickpea", "chhole", "chole", "sambar"], name: "Cooked lentils / beans", kcal: 116, p: 9, c: 20, f: 0.4, serve: 150 },
  { keys: ["salmon"], name: "Salmon", kcal: 208, p: 20, c: 0, f: 13, serve: 150 },
  { keys: ["tuna"], name: "Tuna", kcal: 132, p: 28, c: 0, f: 1, serve: 100 },
  { keys: ["fish", "machli"], name: "White fish", kcal: 110, p: 23, c: 0, f: 1.5, serve: 150 },
  { keys: ["mutton", "lamb", "goat", "keema"], name: "Mutton", kcal: 258, p: 25, c: 0, f: 17, serve: 130 },
  { keys: ["beef", "steak"], name: "Beef", kcal: 250, p: 26, c: 0, f: 15, serve: 130 },
  { keys: ["peanut butter"], name: "Peanut butter", kcal: 588, p: 25, c: 20, f: 50, serve: 20 },
  { keys: ["peanut", "groundnut"], name: "Peanuts", kcal: 567, p: 26, c: 16, f: 49, serve: 30 },
  { keys: ["almond", "badam", "cashew", "walnut", "nuts", "trail mix"], name: "Mixed nuts", kcal: 600, p: 20, c: 20, f: 50, serve: 30 },
  { keys: ["banana", "kela"], name: "Banana", kcal: 89, p: 1.1, c: 23, f: 0.3, serve: 120 },
  { keys: ["apple"], name: "Apple", kcal: 52, p: 0.3, c: 14, f: 0.2, serve: 180 },
  { keys: ["mango", "aam"], name: "Mango", kcal: 60, p: 0.8, c: 15, f: 0.4, serve: 200 },
  { keys: ["pomegr", "anaar", "anar"], name: "Pomegranate", kcal: 83, p: 1.7, c: 19, f: 1.2, serve: 120 },
  { keys: ["orange", "mosambi", "sweet lime"], name: "Orange", kcal: 47, p: 0.9, c: 12, f: 0.1, serve: 130 },
  { keys: ["berries", "strawberr", "blueberr"], name: "Berries", kcal: 45, p: 0.9, c: 10, f: 0.3, serve: 100 },
  { keys: ["beetroot", "beet root", "bit root", "chukandar"], name: "Beetroot", kcal: 43, p: 1.6, c: 10, f: 0.2, serve: 100 },
  { keys: ["juice"], name: "Fruit / vegetable juice", kcal: 48, p: 0.5, c: 11, f: 0.1, serve: 200 },
  { keys: ["salad", "vegetable", "veggies", "sabzi", "bhaji", "broccoli", "spinach", "palak"], name: "Vegetables", kcal: 45, p: 2.5, c: 7, f: 0.5, serve: 100 },
  { keys: ["paratha"], name: "Paratha", kcal: 330, p: 7, c: 45, f: 13, serve: 90 },
  { keys: ["dosa", "idli", "uttapam"], name: "Dosa / idli", kcal: 180, p: 5, c: 32, f: 3.5, serve: 120 },
  { keys: ["poha"], name: "Poha", kcal: 130, p: 2.5, c: 26, f: 2.5, serve: 200 },
  { keys: ["upma"], name: "Upma", kcal: 150, p: 3.5, c: 24, f: 4.5, serve: 200 },
  { keys: ["pizza"], name: "Pizza", kcal: 266, p: 11, c: 33, f: 10, serve: 250 },
  { keys: ["burger", "vada pav", "sandwich"], name: "Burger / sandwich", kcal: 260, p: 12, c: 30, f: 11, serve: 200 },
  { keys: ["fries", "chips", "wafers"], name: "Fries / chips", kcal: 312, p: 3.4, c: 41, f: 15, serve: 100 },
  { keys: ["ice cream", "dessert", "cake", "sweet", "mithai", "gulab jamun", "halwa"], name: "Dessert", kcal: 350, p: 5, c: 45, f: 17, serve: 100 },
  { keys: ["cheese"], name: "Cheese", kcal: 402, p: 25, c: 1.3, f: 33, serve: 20 },
  { keys: ["butter", "ghee", "oil"], name: "Butter / ghee / oil", kcal: 810, p: 0.5, c: 0.5, f: 90, serve: 10 },
  { keys: ["coffee", "tea", "chai"], name: "Tea / coffee with milk", kcal: 40, p: 1.5, c: 5, f: 1.4, serve: 200 },
  { keys: ["soup"], name: "Soup", kcal: 55, p: 3, c: 7, f: 1.5, serve: 250 },
  { keys: ["shake", "smoothie"], name: "Smoothie", kcal: 90, p: 3, c: 15, f: 2, serve: 300 },
];

const MILK_REF = REFERENCE.find((r) => r.name === "Milk")!;

/** Fallback when a described item is not recognised. */
const GENERIC: Ref = { keys: [], name: "mixed food", kcal: 150, p: 8, c: 16, f: 6, serve: 150 };

/** ~150 ml toned milk, added when a dish is described as made with milk. */
const MILK_ADDON = { kcal: 90, p: 5, c: 7, f: 5, ml: 150 };

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Split "oats + banana, 2 eggs and toast" into individual items. */
function splitItems(text: string): string[] {
  return text
    .split(/\s*(?:\+|,|;|\/|&|\band\b)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Hit = { ref: Ref; key: string };

/** Recognise foods in one item phrase, preferring the most specific match. */
function matchItem(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const ref of REFERENCE) {
    const matched = ref.keys.filter((k) => text.includes(k)).sort((a, b) => b.length - a.length)[0];
    if (matched) hits.push({ ref, key: matched });
  }
  // Drop a match whose word is part of another match's longer phrase
  // (e.g. plain "oats" when "protein oats" also matched).
  let filtered = hits.filter((h) => !hits.some((o) => o.key !== h.key && o.key.includes(h.key)));
  // If a matched food already implies milk, don't also add plain milk.
  if (filtered.length > 1 && filtered.some((h) => h.ref !== MILK_REF && /milk/.test(h.ref.name))) {
    filtered = filtered.filter((h) => h.ref !== MILK_REF);
  }
  return filtered;
}

type ItemResult = {
  label: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  recognised: boolean;
};

function estimateItem(phrase: string, sharedGrams: number | null, isOnlyItem: boolean): ItemResult {
  const text = phrase.toLowerCase();
  const hits = matchItem(text);
  const refs = hits.length ? hits.map((h) => h.ref) : [GENERIC];

  const inlineGrams = parseServingToGrams(phrase);
  const allDry = hits.length > 0 && refs.every((r) => r.dry);
  const light = /\b(little|less|light|minimal|bit of|few drop|drizzle|small amount)\b/.test(text);

  // The "primary" food is the first one named in the phrase; sides/condiments
  // (oil, salad next to a main) keep their own typical portion.
  const ordered = [...hits].sort((a, b) => text.indexOf(a.key) - text.indexOf(b.key));
  const primary: Ref | undefined = ordered[0]?.ref ?? refs[0];

  let kcal = 0;
  let p = 0;
  let c = 0;
  let f = 0;

  for (const ref of refs) {
    let grams: number;
    if (ref === primary && inlineGrams != null) {
      grams = inlineGrams;
    } else if (ref === primary && isOnlyItem && sharedGrams != null) {
      grams = sharedGrams;
    } else {
      grams = ref.serve;
    }

    if (light && /oil|butter|ghee/.test(ref.name)) grams *= 0.4;

    const dryInBowl = ref.dry && grams >= 120;
    const useGrams = dryInBowl ? 45 : grams;
    const factor = useGrams / 100;
    kcal += ref.kcal * factor;
    p += ref.p * factor;
    c += ref.c * factor;
    f += ref.f * factor;
  }

  // Milk: added for a dry item served in a bowl, or when the wording says so.
  const saysMilk = /\b(with milk|in milk|cooked in milk|made with milk|and milk|doodh)\b/.test(text);
  const alreadyMilky = refs.some((r) => /milk/.test(r.name));
  if (!alreadyMilky && (allDry || saysMilk)) {
    const mf = (allDry ? 200 : MILK_ADDON.ml) / 150;
    kcal += MILK_ADDON.kcal * mf;
    p += MILK_ADDON.p * mf;
    c += MILK_ADDON.c * mf;
    f += MILK_ADDON.f * mf;
  }

  return {
    label: hits.length ? hits.map((h) => h.ref.name).join(" + ") : phrase.trim(),
    kcal,
    p,
    c,
    f,
    recognised: hits.length > 0,
  };
}

export const referenceAnalyzer: FoodAnalyzer = {
  id: "reference_table",
  async analyze({ description, grams }) {
    const text = description.trim().toLowerCase();
    if (!text) return null;

    const items = splitItems(text);
    const isSingle = items.length <= 1;
    const results = items.map((phrase) => estimateItem(phrase, grams && grams > 0 ? grams : null, isSingle));

    const total = results.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        p: acc.p + r.p,
        c: acc.c + r.c,
        f: acc.f + r.f,
      }),
      { kcal: 0, p: 0, c: 0, f: 0 },
    );

    const recognisedCount = results.filter((r) => r.recognised).length;
    const unknown = results.filter((r) => !r.recognised).map((r) => r.label);
    const matchedFood = results.map((r) => r.label).join(" + ");

    const confidence =
      recognisedCount === 0
        ? 0.2
        : Math.min(0.8, 0.4 + 0.12 * recognisedCount - 0.15 * (unknown.length > 0 ? 1 : 0));

    const noteParts: string[] = [];
    if (results.length > 1) {
      noteParts.push(`Added up ${results.length} items: ${matchedFood}`);
    } else if (recognisedCount) {
      noteParts.push(`Approximate estimate for ${matchedFood}`);
    } else {
      noteParts.push("No exact food match — rough placeholder");
    }
    if (unknown.length) noteParts.push(`couldn't recognise "${unknown.join('", "')}" — check those`);
    noteParts.push("every number stays editable");

    return {
      calories: Math.round(total.kcal),
      protein: round1(total.p),
      carbs: round1(total.c),
      fat: round1(total.f),
      confidence,
      source: recognisedCount ? "reference_table" : "generic_density",
      matchedFood,
      note: noteParts.join(". ") + ".",
    };
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
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env["VITE_SUPABASE_URL"]) || "";
const SUPABASE_KEY: string =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) || "";

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
    const j = (await res.json()) as Partial<MacroEstimate> & { error?: string };
    if (j.error || typeof j.calories !== "number") return null;
    return {
      calories: j.calories,
      protein: Number(j.protein) || 0,
      carbs: Number(j.carbs) || 0,
      fat: Number(j.fat) || 0,
      confidence: typeof j.confidence === "number" ? j.confidence : 0.45,
      source: "vision_ai",
      matchedFood: j.matchedFood ?? "meal from photo",
      note: j.note ?? "AI photo estimate — approximate, please check the numbers before saving.",
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

/**
 * Parses "200g", "1.5 cups", "2 rotis", "1 bowl" into an approximate gram
 * weight. Household measures are checked before weights/volumes so that "bowl"
 * is never mistaken for "litre" (its trailing "l").
 */
export function parseServingToGrams(serving: string): number | null {
  const s = serving.trim().toLowerCase();
  if (!s) return null;

  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5 };
  let num = 1;
  const rawNum = s.match(/\d+(?:\.\d+)?/)?.[0];
  const rawWord = s.match(/\b(one|two|three|four|five|half)\b/)?.[1];
  if (rawNum !== undefined) {
    const parsed = parseFloat(rawNum);
    if (!Number.isNaN(parsed)) num = parsed;
  } else if (rawWord !== undefined) {
    num = words[rawWord] ?? 1;
  }

  if (/\bkatoris?\b/.test(s)) return num * 150;
  if (/\bbowls?\b/.test(s)) return num * 250;
  if (/\b(glass|tumbler)e?s?\b/.test(s)) return num * 200;
  if (/\bcups?\b/.test(s)) return num * 200;
  if (/\b(tbsp|tablespoons?)\b/.test(s)) return num * 15;
  if (/\b(tsp|teaspoons?)\b/.test(s)) return num * 5;
  if (/\bscoops?\b/.test(s)) return num * 30;
  if (/\b(plate|thali|serving|serve|portion)s?\b/.test(s)) return num * 300;
  if (/\bslices?\b/.test(s)) return num * 30;
  if (/\beggs?\b/.test(s)) return num * 50;
  if (/\b(rotis?|chapatis?|phulkas?|parathas?|dosas?|idlis?|pieces?|pcs?)\b/.test(s)) return num * 55;

  if (/\d\s*kg\b/.test(s) || /\bkgs?\b/.test(s)) return num * 1000;
  if (/\d\s*g\b/.test(s) || /\bg(ram|rams|m|ms)?\b/.test(s)) return num;
  if (/\d\s*ml\b/.test(s) || /\bml\b/.test(s)) return num;
  if (/\d\s*l\b/.test(s) || /\b(litre|litres|liter|liters)\b/.test(s)) return num * 1000;

  return num > 20 ? num : null;
}

/** Common serving phrases offered as an autocomplete list on the Add Meal form. */
export const SERVING_SUGGESTIONS = [
  "1 katori",
  "1 bowl",
  "1 cup",
  "1 glass",
  "1 plate",
  "1 scoop",
  "1 piece",
  "2 rotis",
  "100 g",
  "150 g",
  "200 g",
  "250 g",
  "300 g",
];
