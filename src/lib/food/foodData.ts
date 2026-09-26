/**
 * Canonical food table — the numeric authority for typed food descriptions.
 *
 * Every entry stores nutrition per 100 g of the food as eaten. Portion maths is
 * always `value × grams / 100` (see estimator.ts); nothing here or downstream
 * asks an LLM to do arithmetic.
 *
 * Source tags (kept honest on purpose):
 *   usda    – checked against USDA FoodData Central, SR Legacy (CC0 public
 *             domain; citation: U.S. Department of Agriculture, Agricultural
 *             Research Service. FoodData Central). `fdcId` is the record used.
 *   curated – a typical reference value that has NOT been individually checked
 *             against a source record. Shown to users as "Database (approximate)".
 *   recipe  – calculated from an assumed recipe of the entries above.
 *
 * IFCT 2017 (ICMR-NIN) is the right authority for Indian foods, but its terms
 * forbid storing the tables electronically in a product without NIN's written
 * permission, so none of its values are bundled. Add them with `kind: "ifct"`
 * entries only after that permission exists.
 */
import type { Per100g } from "./types";

export type FoodSource =
  { kind: "usda"; fdcId: number; description: string } | { kind: "curated" } | { kind: "recipe" };

export interface RecipeComponent {
  id: string;
  grams: number;
}

export interface CanonicalFood {
  id: string;
  name: string;
  /** Lower-case, hyphen-free phrases. Matched on whole words; plurals ("eggs") are tolerated. */
  aliases: readonly string[];
  per100g: Per100g;
  source: FoodSource;
  /** Amount assumed when the user gives none. Always surfaced as an assumption. */
  defaultPortionG: number;
  /** Grams per countable unit ("3 eggs" → 3 × 50 g). */
  unitG?: number;
  /** Dry cereal-type food: served in a bowl it is treated as a small dry amount plus milk. */
  dryCereal?: boolean;
  containsMilk?: boolean;
  /** Oil/butter/ghee — scaled down for "a little oil". */
  addedFat?: boolean;
  /** Extra caveat on what these numbers cover (e.g. "no cooking oil"). */
  basisNote?: string;
  /** Per matched alias: what we assumed by choosing this entry. */
  assumedFor?: Readonly<Record<string, string>>;
  /** For source.kind === "recipe": ingredients, in grams per 100 g of the finished dish. */
  recipe?: readonly RecipeComponent[];
  recipeNote?: string;
}

type Macros = readonly [kcal: number, p: number, c: number, f: number];

function per(m: Macros): Per100g {
  return { kcal: m[0], p: m[1], c: m[2], f: m[3] };
}

const usda = (fdcId: number, description: string): FoodSource => ({
  kind: "usda",
  fdcId,
  description,
});
const curated: FoodSource = { kind: "curated" };

type BaseFoodInput = Omit<CanonicalFood, "per100g" | "source"> & {
  macros: Macros;
  source: FoodSource;
};

function base(input: BaseFoodInput): CanonicalFood {
  const { macros, ...rest } = input;
  return { ...rest, per100g: per(macros) };
}

const VEG_NOTE = "Plain vegetable — oil or masala used in cooking is not included.";

const BASE_FOODS: CanonicalFood[] = [
  // ── Eggs ────────────────────────────────────────────────────────────────
  base({
    id: "egg_boiled",
    name: "Egg, boiled",
    aliases: ["boiled egg", "hard boiled egg", "whole egg", "egg", "anda"],
    macros: [155, 12.6, 1.12, 10.6],
    source: usda(173424, "Egg, whole, cooked, hard-boiled"),
    defaultPortionG: 50,
    unitG: 50,
    assumedFor: {
      egg: "Assumed boiled — say “fried” or “omelette” if it wasn’t",
      anda: "Assumed boiled — say “fried” or “omelette” if it wasn’t",
    },
  }),
  base({
    id: "egg_fried",
    name: "Egg, fried / omelette",
    aliases: [
      "fried egg",
      "omelette",
      "omelet",
      "egg omelette",
      "egg omelet",
      "scrambled egg",
      "egg bhurji",
      "bhurji",
      "half fry",
      "sunny side up",
    ],
    macros: [196, 13.6, 0.83, 14.8],
    source: usda(173423, "Egg, whole, cooked, fried"),
    defaultPortionG: 46,
    unitG: 46,
    basisNote: "Includes the cooking fat of a fried egg.",
  }),
  base({
    id: "egg_white",
    name: "Egg white",
    aliases: ["egg white", "white of egg"],
    macros: [52, 11, 0.7, 0.2],
    source: curated,
    defaultPortionG: 66,
    unitG: 33,
  }),

  // ── Meat, fish, plant protein ───────────────────────────────────────────
  base({
    id: "chicken_breast",
    name: "Chicken breast, cooked",
    aliases: ["chicken breast", "grilled chicken breast", "grilled chicken"],
    macros: [165, 31, 0, 3.57],
    source: usda(171477, "Chicken, broilers or fryers, breast, meat only, cooked, roasted"),
    defaultPortionG: 150,
  }),
  base({
    id: "chicken_meat",
    name: "Chicken, cooked (no skin)",
    aliases: ["chicken", "roast chicken", "roasted chicken"],
    macros: [190, 28.9, 0, 7.41],
    source: usda(171054, "Chicken, broilers or fryers, meat only, cooked, roasted"),
    defaultPortionG: 150,
    assumedFor: { chicken: "Assumed plain cooked chicken meat without skin" },
  }),
  base({
    id: "mutton",
    name: "Mutton",
    aliases: ["mutton", "lamb", "goat", "keema"],
    macros: [258, 25, 0, 17],
    source: curated,
    defaultPortionG: 130,
  }),
  base({
    id: "beef",
    name: "Beef",
    aliases: ["beef", "steak"],
    macros: [250, 26, 0, 15],
    source: curated,
    defaultPortionG: 130,
  }),
  base({
    id: "salmon",
    name: "Salmon",
    aliases: ["salmon"],
    macros: [208, 20, 0, 13],
    source: curated,
    defaultPortionG: 150,
  }),
  base({
    id: "tuna",
    name: "Tuna",
    aliases: ["tuna"],
    macros: [132, 28, 0, 1],
    source: curated,
    defaultPortionG: 100,
  }),
  base({
    id: "white_fish",
    name: "White fish",
    aliases: ["fish", "machli"],
    macros: [110, 23, 0, 1.5],
    source: curated,
    defaultPortionG: 150,
  }),
  base({
    id: "paneer",
    name: "Paneer",
    aliases: ["paneer"],
    macros: [296, 20, 3.4, 22],
    source: curated,
    defaultPortionG: 60,
  }),
  base({
    id: "tofu",
    name: "Tofu",
    aliases: ["tofu"],
    macros: [144, 15, 3, 8],
    source: curated,
    defaultPortionG: 100,
  }),
  base({
    id: "whey",
    name: "Whey protein powder",
    aliases: ["whey", "whey protein", "protein shake", "protein powder", "mass gainer"],
    macros: [400, 78, 8, 6],
    source: curated,
    defaultPortionG: 30,
    assumedFor: {
      "protein shake": "Powder only — mixed with water assumed; add “with milk” if not",
      whey: "Powder only — mixed with water assumed; add “with milk” if not",
    },
  }),
  base({
    id: "lentils_cooked",
    name: "Lentils / dal, boiled",
    aliases: ["dal", "daal", "dhal", "lentil", "lentils", "moong dal", "masoor dal", "toor dal"],
    macros: [116, 9.02, 20.1, 0.38],
    source: usda(172421, "Lentils, mature seeds, cooked, boiled, without salt"),
    defaultPortionG: 150,
    basisNote:
      "Plain boiled lentils — tadka (tempering) oil and thin-dal dilution are not modelled.",
  }),
  base({
    id: "chickpeas_cooked",
    name: "Chickpeas, cooked",
    aliases: ["chana", "chickpea", "chickpeas", "chhole", "chole"],
    macros: [164, 8.9, 27.4, 2.6],
    source: curated,
    defaultPortionG: 150,
    basisNote: "Plain boiled chickpeas — gravy and oil are not included.",
  }),
  base({
    id: "rajma_cooked",
    name: "Kidney beans, cooked",
    aliases: ["rajma", "kidney beans"],
    macros: [127, 8.7, 22.8, 0.5],
    source: curated,
    defaultPortionG: 150,
    basisNote: "Plain boiled beans — gravy and oil are not included.",
  }),

  // ── Dairy ───────────────────────────────────────────────────────────────
  base({
    id: "milk",
    name: "Milk",
    aliases: ["milk", "doodh"],
    macros: [62, 3.3, 4.8, 3.3],
    source: curated,
    defaultPortionG: 200,
    containsMilk: true,
  }),
  base({
    id: "yogurt_plain",
    name: "Curd / plain yogurt",
    aliases: ["curd", "dahi", "yogurt", "yoghurt", "plain yogurt", "plain curd"],
    macros: [61, 3.5, 4.7, 3.3],
    source: curated,
    defaultPortionG: 150,
  }),
  base({
    id: "greek_yogurt",
    name: "Greek yogurt",
    aliases: ["greek yogurt", "greek yoghurt"],
    macros: [97, 9, 4, 5],
    source: curated,
    defaultPortionG: 150,
  }),
  base({
    id: "buttermilk",
    name: "Buttermilk (chaas)",
    aliases: ["buttermilk", "chaas", "chhach", "mattha"],
    macros: [40, 3.3, 4.8, 0.9],
    source: curated,
    defaultPortionG: 200,
  }),
  base({
    id: "cheese",
    name: "Cheese",
    aliases: ["cheese", "cheddar", "mozzarella"],
    macros: [402, 25, 1.3, 33],
    source: curated,
    defaultPortionG: 20,
  }),

  // ── Grains & staples ────────────────────────────────────────────────────
  base({
    id: "rice_cooked",
    name: "Rice, cooked",
    aliases: [
      "rice",
      "cooked rice",
      "white rice",
      "steamed rice",
      "boiled rice",
      "plain rice",
      "basmati rice",
      "chawal",
    ],
    macros: [130, 2.69, 28.2, 0.28],
    source: usda(168878, "Rice, white, long-grain, regular, enriched, cooked"),
    defaultPortionG: 180,
    assumedFor: {
      rice: "Assumed cooked weight — uncooked rice has about 2.7× the calories per gram",
      chawal: "Assumed cooked weight — uncooked rice has about 2.7× the calories per gram",
    },
  }),
  base({
    id: "roti",
    name: "Roti / chapati",
    aliases: ["roti", "chapati", "chapatti", "phulka"],
    macros: [297, 9, 58, 3.7],
    source: curated,
    defaultPortionG: 45,
    unitG: 45,
  }),
  base({
    id: "paratha",
    name: "Paratha",
    aliases: ["paratha"],
    macros: [330, 7, 45, 13],
    source: curated,
    defaultPortionG: 90,
    unitG: 90,
  }),
  base({
    id: "bread",
    name: "Bread",
    aliases: ["bread", "toast"],
    macros: [265, 9, 49, 3.2],
    source: curated,
    defaultPortionG: 60,
    unitG: 30,
  }),
  base({
    id: "protein_oats",
    name: "Flavoured protein oats with milk",
    aliases: [
      "protein oats",
      "protein muesli",
      "flavoured oats",
      "flavored oats",
      "chocolate oats",
      "yogabar",
      "yoga bar",
      "oats shake",
    ],
    macros: [120, 6, 15, 3.5],
    source: curated,
    defaultPortionG: 250,
    containsMilk: true,
  }),
  base({
    id: "rolled_oats",
    name: "Rolled oats (dry)",
    aliases: ["rolled oats", "raw oats", "dry oats", "oats dry", "overnight oats"],
    macros: [379, 13, 67, 6.5],
    source: curated,
    defaultPortionG: 40,
    dryCereal: true,
  }),
  base({
    id: "granola",
    name: "Granola / muesli (dry)",
    aliases: ["granola", "muesli"],
    macros: [450, 10, 64, 15],
    source: curated,
    defaultPortionG: 45,
    dryCereal: true,
  }),
  base({
    id: "oats_cooked",
    name: "Oats porridge, cooked",
    aliases: ["oats", "oatmeal", "porridge", "dalia", "daliya"],
    macros: [95, 3.6, 15, 2.4],
    source: curated,
    defaultPortionG: 250,
    assumedFor: {
      oats: "Assumed cooked porridge — say “dry oats” or “rolled oats” if you weighed them dry (about 4× the calories per gram)",
      oatmeal:
        "Assumed cooked porridge — say “dry oats” if you weighed them dry (about 4× the calories per gram)",
    },
  }),
  base({
    id: "cereal",
    name: "Breakfast cereal (dry)",
    aliases: ["cornflakes", "corn flakes", "cereal"],
    macros: [378, 7, 84, 1],
    source: curated,
    defaultPortionG: 40,
    dryCereal: true,
  }),
  base({
    id: "pasta_cooked",
    name: "Pasta / noodles, cooked",
    aliases: ["pasta", "noodles", "macaroni", "spaghetti", "maggi"],
    macros: [158, 6, 31, 0.9],
    source: curated,
    defaultPortionG: 180,
  }),
  base({
    id: "potato",
    name: "Potato, boiled",
    aliases: ["potato", "aloo"],
    macros: [87, 2, 20, 0.1],
    source: curated,
    defaultPortionG: 150,
  }),
  base({
    id: "sweet_potato",
    name: "Sweet potato",
    aliases: ["sweet potato", "shakarkandi"],
    macros: [90, 2, 21, 0.2],
    source: curated,
    defaultPortionG: 150,
  }),
  base({
    id: "dosa_idli",
    name: "Dosa / idli",
    aliases: ["dosa", "idli", "uttapam"],
    macros: [180, 5, 32, 3.5],
    source: curated,
    defaultPortionG: 120,
    unitG: 55,
  }),
  base({
    id: "poha",
    name: "Poha",
    aliases: ["poha"],
    macros: [130, 2.5, 26, 2.5],
    source: curated,
    defaultPortionG: 200,
  }),
  base({
    id: "upma",
    name: "Upma",
    aliases: ["upma"],
    macros: [150, 3.5, 24, 4.5],
    source: curated,
    defaultPortionG: 200,
  }),

  // ── Fruit ───────────────────────────────────────────────────────────────
  base({
    id: "banana",
    name: "Banana",
    aliases: ["banana", "kela"],
    macros: [89, 1.1, 23, 0.3],
    source: curated,
    defaultPortionG: 120,
    unitG: 118,
  }),
  base({
    id: "apple",
    name: "Apple",
    aliases: ["apple"],
    macros: [52, 0.3, 14, 0.2],
    source: curated,
    defaultPortionG: 180,
    unitG: 182,
  }),
  base({
    id: "mango",
    name: "Mango",
    aliases: ["mango", "aam"],
    macros: [60, 0.8, 15, 0.4],
    source: curated,
    defaultPortionG: 200,
  }),
  base({
    id: "pomegranate",
    name: "Pomegranate",
    aliases: ["pomegranate", "anaar", "anar"],
    macros: [83, 1.7, 19, 1.2],
    source: curated,
    defaultPortionG: 120,
  }),
  base({
    id: "orange",
    name: "Orange",
    aliases: ["orange", "mosambi", "sweet lime"],
    macros: [47, 0.9, 12, 0.1],
    source: curated,
    defaultPortionG: 130,
    unitG: 131,
  }),
  base({
    id: "berries",
    name: "Berries",
    aliases: ["berries", "strawberry", "strawberries", "blueberry", "blueberries"],
    macros: [45, 0.9, 10, 0.3],
    source: curated,
    defaultPortionG: 100,
  }),
  base({
    id: "watermelon",
    name: "Watermelon",
    aliases: ["watermelon", "tarbooz"],
    macros: [30, 0.61, 7.55, 0.15],
    source: curated,
    defaultPortionG: 200,
  }),
  base({
    id: "papaya",
    name: "Papaya",
    aliases: ["papaya", "papita"],
    macros: [43, 0.47, 10.82, 0.26],
    source: curated,
    defaultPortionG: 150,
  }),
  base({
    id: "grapes",
    name: "Grapes",
    aliases: ["grapes", "grape", "angoor"],
    macros: [69, 0.72, 18.1, 0.16],
    source: curated,
    defaultPortionG: 100,
  }),
  base({
    id: "pineapple",
    name: "Pineapple",
    aliases: ["pineapple", "ananas"],
    macros: [50, 0.54, 13.12, 0.12],
    source: curated,
    defaultPortionG: 150,
  }),
  base({
    id: "guava",
    name: "Guava",
    aliases: ["guava", "amrood"],
    macros: [68, 2.55, 14.32, 0.95],
    source: curated,
    defaultPortionG: 100,
  }),
  base({
    id: "pear",
    name: "Pear",
    aliases: ["pear", "nashpati"],
    macros: [57, 0.36, 15.23, 0.14],
    source: curated,
    defaultPortionG: 170,
  }),
  base({
    id: "juice",
    name: "Fruit / vegetable juice",
    aliases: ["juice"],
    macros: [48, 0.5, 11, 0.1],
    source: curated,
    defaultPortionG: 200,
  }),

  // ── Vegetables ──────────────────────────────────────────────────────────
  base({
    id: "cucumber",
    name: "Cucumber",
    aliases: ["cucumber", "kheera", "kakdi"],
    macros: [15, 0.65, 3.63, 0.11],
    source: usda(168409, "Cucumber, with peel, raw"),
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "tomato",
    name: "Tomato",
    aliases: ["tomato", "tamatar"],
    macros: [18, 0.88, 3.89, 0.2],
    source: usda(170457, "Tomatoes, red, ripe, raw, year round average"),
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "onion",
    name: "Onion",
    aliases: ["onion", "pyaz", "pyaaz"],
    macros: [40, 1.1, 9.34, 0.1],
    source: usda(170000, "Onions, raw"),
    defaultPortionG: 80,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "carrot",
    name: "Carrot",
    aliases: ["carrot", "gajar"],
    macros: [41, 0.93, 9.58, 0.24],
    source: curated,
    defaultPortionG: 80,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "cabbage",
    name: "Cabbage",
    aliases: ["cabbage", "patta gobi"],
    macros: [25, 1.28, 5.8, 0.1],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "cauliflower",
    name: "Cauliflower",
    aliases: ["cauliflower", "gobi", "phool gobi"],
    macros: [25, 1.98, 5.3, 0.28],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "capsicum",
    name: "Capsicum (bell pepper)",
    aliases: ["capsicum", "bell pepper", "green pepper", "shimla mirch"],
    macros: [20, 0.86, 4.64, 0.17],
    source: curated,
    defaultPortionG: 80,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "okra",
    name: "Okra (bhindi)",
    aliases: ["okra", "bhindi", "lady finger"],
    macros: [33, 1.93, 7.45, 0.19],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "eggplant",
    name: "Eggplant (brinjal)",
    aliases: ["eggplant", "brinjal", "baingan", "aubergine"],
    macros: [25, 0.98, 5.88, 0.18],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "spinach",
    name: "Spinach",
    aliases: ["spinach", "palak"],
    macros: [23, 2.86, 3.63, 0.39],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "broccoli",
    name: "Broccoli",
    aliases: ["broccoli"],
    macros: [34, 2.82, 6.64, 0.37],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "green_peas",
    name: "Green peas",
    aliases: ["green peas", "peas", "matar"],
    macros: [81, 5.42, 14.45, 0.4],
    source: curated,
    defaultPortionG: 80,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "sweet_corn",
    name: "Sweet corn",
    aliases: ["sweet corn", "corn", "bhutta"],
    macros: [86, 3.27, 18.7, 1.35],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "mushroom",
    name: "Mushrooms",
    aliases: ["mushroom", "mushrooms"],
    macros: [22, 3.09, 3.26, 0.34],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "bottle_gourd",
    name: "Bottle gourd (lauki)",
    aliases: ["lauki", "doodhi", "bottle gourd"],
    macros: [14, 0.62, 3.39, 0.02],
    source: curated,
    defaultPortionG: 150,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "green_beans",
    name: "Green beans",
    aliases: ["green beans", "french beans"],
    macros: [31, 1.83, 6.97, 0.22],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "radish",
    name: "Radish (mooli)",
    aliases: ["radish", "mooli"],
    macros: [16, 0.68, 3.4, 0.1],
    source: curated,
    defaultPortionG: 80,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "lettuce",
    name: "Lettuce",
    aliases: ["lettuce"],
    macros: [15, 1.36, 2.87, 0.15],
    source: curated,
    defaultPortionG: 50,
    basisNote: VEG_NOTE,
  }),
  base({
    id: "beetroot",
    name: "Beetroot",
    aliases: ["beetroot", "beet root", "bit root", "chukandar"],
    macros: [43, 1.6, 10, 0.2],
    source: curated,
    defaultPortionG: 100,
  }),
  base({
    id: "mixed_veg",
    name: "Mixed vegetables, cooked plain",
    aliases: ["vegetable", "vegetables", "veggies", "mixed veg", "mixed vegetables"],
    macros: [45, 2.5, 7, 0.5],
    source: curated,
    defaultPortionG: 100,
    basisNote: VEG_NOTE,
  }),

  // ── Fats, nuts, drinks, water ───────────────────────────────────────────
  base({
    id: "ghee",
    name: "Ghee",
    aliases: ["ghee", "clarified butter", "desi ghee"],
    macros: [876, 0.28, 0, 99.5],
    source: usda(173412, "Butter oil, anhydrous"),
    defaultPortionG: 10,
    addedFat: true,
  }),
  base({
    id: "butter",
    name: "Butter",
    aliases: ["butter", "makhan"],
    macros: [717, 0.85, 0.06, 81.1],
    source: curated,
    defaultPortionG: 10,
    addedFat: true,
  }),
  base({
    id: "oil",
    name: "Cooking oil",
    aliases: [
      "oil",
      "cooking oil",
      "vegetable oil",
      "olive oil",
      "mustard oil",
      "coconut oil",
      "sunflower oil",
    ],
    macros: [884, 0, 0, 100],
    source: curated,
    defaultPortionG: 10,
    addedFat: true,
  }),
  base({
    id: "peanut_butter",
    name: "Peanut butter",
    aliases: ["peanut butter"],
    macros: [588, 25, 20, 50],
    source: curated,
    defaultPortionG: 20,
  }),
  base({
    id: "peanuts",
    name: "Peanuts",
    aliases: ["peanut", "groundnut", "moongphali"],
    macros: [567, 26, 16, 49],
    source: curated,
    defaultPortionG: 30,
  }),
  base({
    id: "mixed_nuts",
    name: "Mixed nuts",
    aliases: ["almond", "badam", "cashew", "walnut", "nuts", "trail mix"],
    macros: [600, 20, 20, 50],
    source: curated,
    defaultPortionG: 30,
  }),
  base({
    id: "tea_milk",
    name: "Tea / coffee with milk",
    aliases: ["coffee", "tea", "chai", "milk tea", "milk coffee"],
    macros: [40, 1.5, 5, 1.4],
    source: curated,
    defaultPortionG: 200,
    containsMilk: true,
    assumedFor: {
      coffee: "Assumed with milk and a little sugar — say “black coffee” if not",
      tea: "Assumed with milk and a little sugar — say “black tea” if not",
      chai: "Assumed with milk and a little sugar",
    },
  }),
  base({
    id: "black_drink",
    name: "Black coffee / plain tea",
    aliases: ["black coffee", "black tea", "green tea", "plain tea"],
    macros: [1, 0.1, 0.2, 0],
    source: curated,
    defaultPortionG: 200,
  }),
  base({
    id: "water",
    name: "Water",
    aliases: ["water"],
    macros: [0, 0, 0, 0],
    source: curated,
    defaultPortionG: 250,
  }),
  base({
    id: "soup",
    name: "Soup",
    aliases: ["soup"],
    macros: [55, 3, 7, 1.5],
    source: curated,
    defaultPortionG: 250,
  }),
  base({
    id: "smoothie",
    name: "Smoothie",
    aliases: ["shake", "smoothie"],
    macros: [90, 3, 15, 2],
    source: curated,
    defaultPortionG: 300,
  }),

  // ── Ready foods & sweets (lumped, approximate) ──────────────────────────
  base({
    id: "pizza",
    name: "Pizza",
    aliases: ["pizza"],
    macros: [266, 11, 33, 10],
    source: curated,
    defaultPortionG: 250,
  }),
  base({
    id: "burger_sandwich",
    name: "Burger / sandwich",
    aliases: ["burger", "vada pav", "sandwich"],
    macros: [260, 12, 30, 11],
    source: curated,
    defaultPortionG: 200,
  }),
  base({
    id: "fries",
    name: "Fries / chips",
    aliases: ["fries", "french fries", "chips", "wafers"],
    macros: [312, 3.4, 41, 15],
    source: curated,
    defaultPortionG: 100,
  }),
  base({
    id: "dessert",
    name: "Dessert",
    aliases: ["ice cream", "dessert", "cake", "sweet", "mithai", "gulab jamun", "halwa"],
    macros: [350, 5, 45, 17],
    source: curated,
    defaultPortionG: 100,
  }),
];

/**
 * Dishes calculated from the entries above. The recipe is an ASSUMPTION about a
 * typical home-style preparation — restaurant versions are usually oilier — so
 * these are always presented as "recipe-derived", never as measured facts.
 * Weights are grams of ingredient per 100 g of finished dish (they sum to 100).
 */
type RecipeInput = Omit<CanonicalFood, "per100g" | "source" | "recipe"> & {
  recipe: readonly RecipeComponent[];
};

const RECIPE_FOODS: RecipeInput[] = [
  {
    id: "biryani_chicken",
    name: "Chicken biryani (home-style)",
    aliases: ["chicken biryani", "chicken biriyani", "biryani", "biriyani"],
    defaultPortionG: 250,
    recipe: [
      { id: "rice_cooked", grams: 60 },
      { id: "chicken_meat", grams: 20 },
      { id: "ghee", grams: 6 },
      { id: "onion", grams: 8 },
      { id: "tomato", grams: 4 },
      { id: "water", grams: 2 },
    ],
    recipeNote: "Assumes a typical home recipe (about 60% rice, 20% chicken, 6% ghee/oil).",
    assumedFor: {
      biryani: "Assumed chicken biryani — say “veg” or “mutton” biryani if not",
      biriyani: "Assumed chicken biryani — say “veg” or “mutton” biryani if not",
    },
  },
  {
    id: "biryani_veg",
    name: "Veg biryani (home-style)",
    aliases: ["veg biryani", "vegetable biryani", "veg biriyani", "vegetable biriyani"],
    defaultPortionG: 250,
    recipe: [
      { id: "rice_cooked", grams: 62 },
      { id: "mixed_veg", grams: 20 },
      { id: "ghee", grams: 6 },
      { id: "onion", grams: 8 },
      { id: "tomato", grams: 4 },
    ],
    recipeNote: "Assumes a typical home recipe (about 62% rice, 20% vegetables, 6% ghee/oil).",
  },
  {
    id: "biryani_mutton",
    name: "Mutton biryani (home-style)",
    aliases: ["mutton biryani", "lamb biryani", "goat biryani", "mutton biriyani"],
    defaultPortionG: 250,
    recipe: [
      { id: "rice_cooked", grams: 58 },
      { id: "mutton", grams: 22 },
      { id: "ghee", grams: 6 },
      { id: "onion", grams: 8 },
      { id: "tomato", grams: 4 },
      { id: "water", grams: 2 },
    ],
    recipeNote: "Assumes a typical home recipe (about 58% rice, 22% mutton, 6% ghee/oil).",
  },
  {
    id: "pulao",
    name: "Vegetable pulao (home-style)",
    aliases: ["pulao", "pulav", "veg pulao", "vegetable pulao"],
    defaultPortionG: 200,
    recipe: [
      { id: "rice_cooked", grams: 72 },
      { id: "mixed_veg", grams: 16 },
      { id: "oil", grams: 4 },
      { id: "onion", grams: 8 },
    ],
    recipeNote: "Assumes a typical home recipe (about 72% rice, 16% vegetables, 4% oil).",
  },
  {
    id: "khichdi",
    name: "Khichdi (home-style)",
    aliases: ["khichdi", "khichri", "khichadi"],
    defaultPortionG: 250,
    recipe: [
      { id: "rice_cooked", grams: 35 },
      { id: "lentils_cooked", grams: 35 },
      { id: "ghee", grams: 3 },
      { id: "water", grams: 27 },
    ],
    recipeNote: "Assumes a soft khichdi (equal rice and dal, 3% ghee, the rest water).",
  },
  {
    id: "veg_curry",
    name: "Vegetable sabzi (home-style)",
    aliases: ["sabzi", "sabji", "subzi", "bhaji", "vegetable curry", "veg curry"],
    defaultPortionG: 150,
    recipe: [
      { id: "mixed_veg", grams: 80 },
      { id: "oil", grams: 4 },
      { id: "onion", grams: 8 },
      { id: "tomato", grams: 8 },
    ],
    recipeNote: "Assumes a typical dry/semi-dry sabzi (80% vegetables, 4% oil).",
  },
  {
    id: "salad",
    name: "Raw salad",
    aliases: ["salad", "green salad", "kachumber", "kachumber salad"],
    defaultPortionG: 100,
    recipe: [
      { id: "cucumber", grams: 40 },
      { id: "tomato", grams: 30 },
      { id: "onion", grams: 15 },
      { id: "carrot", grams: 15 },
    ],
    recipeNote: "Assumes cucumber, tomato, onion and carrot with no dressing.",
  },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** kcal/protein/carbs/fat per 100 g of a recipe, from its ingredients — pure arithmetic. */
export function deriveRecipePer100g(
  components: readonly RecipeComponent[],
  byId: ReadonlyMap<string, CanonicalFood>,
): Per100g {
  let totalG = 0;
  const sum: Per100g = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const { id, grams } of components) {
    const food = byId.get(id);
    if (!food) throw new Error(`Recipe references unknown food "${id}"`);
    totalG += grams;
    sum.kcal += (food.per100g.kcal * grams) / 100;
    sum.p += (food.per100g.p * grams) / 100;
    sum.c += (food.per100g.c * grams) / 100;
    sum.f += (food.per100g.f * grams) / 100;
  }
  const scale = totalG > 0 ? 100 / totalG : 0;
  return {
    kcal: round2(sum.kcal * scale),
    p: round2(sum.p * scale),
    c: round2(sum.c * scale),
    f: round2(sum.f * scale),
  };
}

const BY_ID = new Map<string, CanonicalFood>(BASE_FOODS.map((food) => [food.id, food]));

const RECIPES: CanonicalFood[] = RECIPE_FOODS.map((input) => {
  const food: CanonicalFood = {
    ...input,
    per100g: deriveRecipePer100g(input.recipe, BY_ID),
    source: { kind: "recipe" },
  };
  BY_ID.set(food.id, food);
  return food;
});

export const FOODS: readonly CanonicalFood[] = [...BASE_FOODS, ...RECIPES];

export function getFood(id: string): CanonicalFood | undefined {
  return BY_ID.get(id);
}
