/**
 * Deterministic text → nutrition estimator.
 *
 * Pipeline for one description:
 *   split into phrases → tokenize → match canonical foods (whole words, longest
 *   phrase wins) → resolve each portion to grams (explicit > household > count
 *   > assumed default) → nutrition = per-100 g × grams / 100 → validate → total.
 *
 * Nothing here reads the user, their goals, locale or any random source: the
 * same text (and serving amount) always yields the same numbers. Foods the
 * table doesn't know are NEVER given an invented value — they come back with
 * provenance "none", zeros, and a flag asking the user to enter them.
 */
import { FOODS, getFood, type CanonicalFood } from "./foodData";
import { parseQuantity, splitItems } from "./portions";
import { weakestProvenance } from "./provenance";
import { sumItems, validateItem, validateTotals } from "./validate";
import type {
  EstimatedItem,
  EstimateSource,
  MacroEstimate,
  NutritionFlag,
  NutritionProvenance,
  PortionBasis,
} from "./types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return cleaned ? cleaned.split(" ") : [];
}

// ── matching ───────────────────────────────────────────────────────────────

interface AliasEntry {
  food: CanonicalFood;
  alias: string;
  tokens: string[];
}

const ALIAS_INDEX: AliasEntry[] = FOODS.flatMap((food) =>
  food.aliases.map((alias) => ({ food, alias, tokens: tokenize(alias) })),
);

interface Match {
  food: CanonicalFood;
  alias: string;
  start: number;
  end: number;
}

function tokenEquals(token: string, aliasToken: string, isLast: boolean): boolean {
  return (
    token === aliasToken || (isLast && (token === `${aliasToken}s` || token === `${aliasToken}es`))
  );
}

/** Foods named in `tokens`. Whole words only ("boiled" never contains "oil"); longest phrase wins. */
export function findMatches(tokens: readonly string[]): Match[] {
  const candidates: Match[] = [];
  for (const entry of ALIAS_INDEX) {
    const n = entry.tokens.length;
    if (n === 0) continue;
    for (let i = 0; i + n <= tokens.length; i++) {
      let ok = true;
      for (let j = 0; j < n; j++) {
        if (!tokenEquals(tokens[i + j] as string, entry.tokens[j] as string, j === n - 1)) {
          ok = false;
          break;
        }
      }
      if (ok) candidates.push({ food: entry.food, alias: entry.alias, start: i, end: i + n });
    }
  }
  candidates.sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) || b.alias.length - a.alias.length || a.start - b.start,
  );

  const used: boolean[] = new Array<boolean>(tokens.length).fill(false);
  const seenFoods = new Set<string>();
  const picked: Match[] = [];
  for (const c of candidates) {
    if (seenFoods.has(c.food.id)) continue;
    let free = true;
    for (let k = c.start; k < c.end; k++) {
      if (used[k]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (let k = c.start; k < c.end; k++) used[k] = true;
    seenFoods.add(c.food.id);
    picked.push(c);
  }
  return picked.sort((a, b) => a.start - b.start);
}

/** Words that mean a cooked dish, not the plain ingredient the table holds. */
const PREPARATION_WORDS = new Set([
  "curry",
  "masala",
  "gravy",
  "korma",
  "tikka",
  "fry",
  "fried",
  "sauteed",
  "bhuna",
  "kadai",
  "kadhai",
  "makhani",
  "tandoori",
  "stuffed",
  "creamy",
]);

const CONNECTORS = new Set(["with", "in", "on", "n", "plus", "alongside"]);

// ── portions ───────────────────────────────────────────────────────────────

const LIGHT_MODIFIER = /\b(little|less|light|minimal|bit of|few drops?|drizzle|small amount)\b/;
const DRY_BOWL_DRY_GRAMS = 45;
const DRY_BOWL_MILK_GRAMS = 200;

function fmtG(g: number): string {
  return `${round1(g)} g`;
}

function per100gText(food: CanonicalFood): string {
  const { kcal, p, c, f } = food.per100g;
  return `${kcal} kcal · ${p} g protein · ${c} g carbs · ${f} g fat per 100 g`;
}

export function describeFoodSource(food: CanonicalFood): string {
  switch (food.source.kind) {
    case "usda":
      return `USDA FoodData Central #${food.source.fdcId} (“${food.source.description}”) — ${per100gText(food)}`;
    case "recipe": {
      const parts = (food.recipe ?? []).map((c) => `${c.grams} g ${getFood(c.id)?.name ?? c.id}`);
      return `Recipe-derived from ${parts.join(", ")} per 100 g of dish — ${per100gText(food)}`;
    }
    case "curated":
      return `Reference table (typical value, not individually verified) — ${per100gText(food)}`;
  }
}

const PORTION_CONFIDENCE: Record<PortionBasis, number> = {
  explicit: 0.9,
  count: 0.85,
  household: 0.7,
  assumed: 0.55,
};
const SOURCE_CONFIDENCE = { usda: 1, curated: 0.9, recipe: 0.7 } as const;

function withFlags(item: EstimatedItem, baseConfidence: number): EstimatedItem {
  const flags: NutritionFlag[] = [...(item.flags ?? []), ...validateItem(item)];
  const hasError = flags.some((f) => f.severity === "error");
  const hasWarn = flags.some((f) => f.severity === "warn");
  const confidence = Math.round(baseConfidence * (hasError ? 0.4 : hasWarn ? 0.7 : 1) * 100) / 100;
  return { ...item, ...(flags.length ? { flags } : {}), confidence };
}

/** One canonical food × a portion, calculated `per-100 g × grams / 100`. */
export function itemFromFood(
  food: CanonicalFood,
  gramsExact: number,
  basis: PortionBasis,
  notes: readonly string[] = [],
  alias?: string,
): EstimatedItem {
  const grams = round1(gramsExact);
  const k = grams / 100;
  const assumptions: string[] = [];
  const aliasNote = alias !== undefined ? food.assumedFor?.[alias] : undefined;
  if (aliasNote) assumptions.push(aliasNote);
  assumptions.push(...notes);
  if (basis === "assumed" && !notes.some((n) => n.startsWith("Assumed"))) {
    assumptions.push(`Assumed ${fmtG(grams)} (a typical serving) — type an amount to change it`);
  }
  if (food.basisNote) assumptions.push(food.basisNote);
  if (food.recipeNote) assumptions.push(food.recipeNote);

  const item: EstimatedItem = {
    label: food.name,
    grams,
    calories: Math.round(food.per100g.kcal * k),
    protein: round1(food.per100g.p * k),
    carbs: round1(food.per100g.c * k),
    fat: round1(food.per100g.f * k),
    recognised: true,
    provenance: food.source.kind === "recipe" ? "recipe" : "database",
    sourceNote: describeFoodSource(food),
    portionBasis: basis,
    assumptions,
    foodId: food.id,
    per100g: food.per100g,
  };
  return withFlags(item, PORTION_CONFIDENCE[basis] * SOURCE_CONFIDENCE[food.source.kind]);
}

function unmatchedItem(phrase: string): EstimatedItem {
  const label = phrase.trim();
  return {
    label,
    grams: null,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    recognised: false,
    provenance: "none",
    confidence: 0,
    flags: [
      {
        code: "no_nutrition_data",
        severity: "warn",
        message: `No nutrition data found for “${label}” — it isn’t counted. Enter its numbers, or reword it (for example “100 g paneer”).`,
      },
    ],
  };
}

interface Plan {
  match: Match;
  grams: number;
  basis: PortionBasis;
  notes: string[];
}

function planPortions(
  phrase: string,
  matches: readonly Match[],
  sharedGrams: number | null,
  isOnlyPhrase: boolean,
): { plans: Plan[]; milkAddon: boolean } {
  const q = parseQuantity(phrase);
  const first = matches[0] as Match;
  const light = LIGHT_MODIFIER.test(phrase.toLowerCase());
  const defaults = (m: Match): Plan => {
    let grams = m.food.defaultPortionG;
    const notes: string[] = [];
    if (light && m.food.addedFat) {
      grams *= 0.4;
      notes.push(`Assumed a small amount of ${m.food.name.toLowerCase()} (${fmtG(grams)})`);
    }
    return { match: m, grams, basis: "assumed", notes };
  };

  // Whole-phrase amount: an explicit weight/volume, a household measure, or the serving field.
  let total: number | null = null;
  let basis: PortionBasis = "explicit";
  let reading: string | null = null;
  if (q.grams != null) {
    total = q.grams;
    basis = q.basis === "household" ? "household" : "explicit";
    if (q.basis === "household") reading = `“${q.matched ?? ""}” read as about ${fmtG(q.grams)}`;
  } else if (
    !(q.count != null && first.food.unitG != null) &&
    isOnlyPhrase &&
    sharedGrams != null
  ) {
    total = sharedGrams;
  }

  if (total != null) {
    const allDry = matches.every((m) => m.food.dryCereal);
    const hasMilk = matches.some((m) => m.food.containsMilk);
    if (basis === "household" && allDry && !hasMilk && total >= 120) {
      const dryTotal = DRY_BOWL_DRY_GRAMS;
      const weightSum = matches.reduce((s, m) => s + m.food.defaultPortionG, 0);
      return {
        milkAddon: true,
        plans: matches.map((m) => ({
          match: m,
          grams: (dryTotal * m.food.defaultPortionG) / weightSum,
          basis: "household" as const,
          notes: [
            `“${q.matched ?? "a bowl"}” of ${m.food.name.toLowerCase()} is treated as about ${fmtG(dryTotal)} dry plus milk`,
          ],
        })),
      };
    }
    if (matches.length === 1) {
      return {
        milkAddon: false,
        plans: [{ match: first, grams: total, basis, notes: reading ? [reading] : [] }],
      };
    }
    const weightSum = matches.reduce((s, m) => s + m.food.defaultPortionG, 0);
    const names = matches.map((m) => m.food.name).join(" and ");
    return {
      milkAddon: false,
      plans: matches.map((m) => ({
        match: m,
        grams: (total as number) * (m.food.defaultPortionG / weightSum),
        basis,
        notes: [
          `${fmtG(total as number)} shared between ${names} by typical proportions`,
          ...(reading ? [reading] : []),
        ],
      })),
    };
  }

  // Count of a countable food ("3 boiled eggs"): applies to the first food only.
  if (q.count != null && first.food.unitG != null) {
    const plans = matches.map((m, i): Plan =>
      i === 0
        ? {
            match: m,
            grams: (q.count as number) * (first.food.unitG as number),
            basis: "count",
            notes: [`${q.count} × ${fmtG(first.food.unitG as number)} each`],
          }
        : defaults(m),
    );
    return { plans, milkAddon: false };
  }

  const plans = matches.map((m, i): Plan => {
    const plan = defaults(m);
    if (i === 0 && q.count != null) {
      plan.notes.push(
        `Couldn’t use “${q.count}” as an amount for ${m.food.name.toLowerCase()} — assumed a typical serving`,
      );
    }
    return plan;
  });
  const allDry = matches.every((m) => m.food.dryCereal);
  const hasMilk = matches.some((m) => m.food.containsMilk);
  return { plans, milkAddon: allDry && !hasMilk };
}

function estimatePhrase(phrase: string, sharedGrams: number | null, isOnlyPhrase: boolean) {
  const tokens = tokenize(phrase);
  let matches = findMatches(tokens);
  if (matches.length === 0) return [unmatchedItem(phrase)];

  if (matches.length > 1 && matches.some((m) => m.food.id !== "milk" && m.food.containsMilk)) {
    matches = matches.filter((m) => m.food.id !== "milk");
  }

  const covered = new Set<number>();
  for (const m of matches) for (let k = m.start; k < m.end; k++) covered.add(k);
  const preparation = tokens.filter((t, i) => !covered.has(i) && PREPARATION_WORDS.has(t));
  const compound = matches.length > 1 && !tokens.some((t) => CONNECTORS.has(t));

  const { plans, milkAddon } = planPortions(phrase, matches, sharedGrams, isOnlyPhrase);

  const items = plans.map((plan) => {
    let item = itemFromFood(plan.match.food, plan.grams, plan.basis, plan.notes, plan.match.alias);
    if (preparation.length > 0 && item.provenance === "database") {
      item = withPreparationFlag(item, preparation[0] as string);
    }
    if (compound) {
      item = withFlag(item, {
        code: "compound_reading",
        severity: "warn",
        message: `“${phrase.trim()}” was read as separate foods (${matches.map((m) => m.food.name).join(" + ")}) with typical portions. If it is one dish, edit the numbers.`,
      });
    }
    return item;
  });

  if (milkAddon) {
    const milk = getFood("milk");
    if (milk) {
      items.push(
        itemFromFood(milk, DRY_BOWL_MILK_GRAMS, "assumed", [
          `Assumed served with ${fmtG(DRY_BOWL_MILK_GRAMS)} of milk — remove this line if you had it dry`,
        ]),
      );
    }
  }
  return items;
}

/** Adds a warning flag and lowers the item's confidence, once per flag code. */
function withFlag(item: EstimatedItem, flag: NutritionFlag): EstimatedItem {
  if (item.flags?.some((f) => f.code === flag.code)) return item;
  const flags = [...(item.flags ?? []), flag];
  const base = item.confidence ?? 0.5;
  const hasError = flags.some((f) => f.severity === "error");
  return {
    ...item,
    flags,
    confidence: Math.round(base * (hasError ? 0.4 : 0.7) * 100) / 100,
  };
}

function withPreparationFlag(item: EstimatedItem, word: string): EstimatedItem {
  return withFlag(item, {
    code: "preparation_not_modelled",
    severity: "warn",
    message: `“${word}” preparation isn’t modelled — these numbers are for plain ${item.label.toLowerCase()}. Add oil or gravy separately, or edit the numbers.`,
  });
}

// ── assembling an estimate ─────────────────────────────────────────────────

const SOURCE_INTRO: Record<NutritionProvenance, string> = {
  label: "Product label",
  database: "Reference table",
  recipe: "Reference table and assumed recipe",
  estimate: "Estimate",
  user: "Your numbers",
  none: "Estimate",
};

export function assembleEstimate(
  items: readonly EstimatedItem[],
  options: { source?: EstimateSource; confidenceCap?: number; intro?: string } = {},
): MacroEstimate {
  const sum = sumItems(items);
  const totals = {
    calories: Math.round(sum.calories),
    protein: round1(sum.protein),
    carbs: round1(sum.carbs),
    fat: round1(sum.fat),
  };
  const totalFlags = validateTotals(items, totals);

  const counted = items.filter((i) => i.provenance !== "none");
  const uncounted = items.filter((i) => i.provenance === "none");
  const provenance = weakestProvenance(items);

  const weight = (i: EstimatedItem) => Math.max(i.calories, 1);
  const weightSum = counted.reduce((s, i) => s + weight(i), 0);
  const weighted =
    weightSum > 0
      ? counted.reduce((s, i) => s + (i.confidence ?? 0) * weight(i), 0) / weightSum
      : 0;
  const unmatchedShare = items.length > 0 ? uncounted.length / items.length : 0;
  let confidence = counted.length === 0 ? 0.1 : weighted * (1 - 0.5 * unmatchedShare);
  if (totalFlags.length > 0) confidence *= 0.4;
  confidence = Math.round(Math.min(confidence, options.confidenceCap ?? 0.85) * 100) / 100;

  // Any flag at all (missing data, failed sanity check, unmodelled preparation,
  // ambiguous reading, implausible portion) means a person should look.
  const needsReview =
    uncounted.length > 0 || totalFlags.length > 0 || items.some((i) => (i.flags?.length ?? 0) > 0);

  const source: EstimateSource =
    options.source ??
    (counted.length === 0
      ? "unmatched"
      : counted.some((i) => i.provenance === "recipe")
        ? "recipe_derived"
        : "reference_table");

  const parts: string[] = [];
  if (counted.length > 0) {
    const list = counted
      .map((i) => (i.grams != null ? `${i.label} ${Math.round(i.grams)} g` : i.label))
      .join(" + ");
    parts.push(`${options.intro ?? SOURCE_INTRO[provenance]}: ${list}`);
  }
  if (uncounted.length > 0) {
    parts.push(
      `No nutrition data for ${uncounted.map((i) => `“${i.label}”`).join(", ")} — not counted, please enter ${uncounted.length > 1 ? "those" : "it"} yourself`,
    );
  }
  if (counted.length === 0 && uncounted.length === 0) parts.push("Nothing to estimate");
  parts.push("Approximate, not measured — every number stays editable");

  return {
    ...totals,
    confidence,
    source,
    provenance,
    needsReview,
    matchedFood: counted.map((i) => i.label).join(" + ") || items.map((i) => i.label).join(" + "),
    note: `${parts.join(". ")}.`,
    items: [...items],
  };
}

/** Estimate a typed description. Pure and synchronous — no network, no user context. */
export function estimateFromText(
  description: string,
  sharedGrams: number | null,
): MacroEstimate | null {
  const text = description.trim();
  if (!text) return null;
  const phrases = splitItems(text);
  // Only separators ("+", ",") — nothing to estimate, so don't invent an empty result.
  if (phrases.length === 0) return null;
  const isOnlyPhrase = phrases.length <= 1;
  const items = phrases.flatMap((phrase) => estimatePhrase(phrase, sharedGrams, isOnlyPhrase));
  return assembleEstimate(items);
}

// ── photo (vision) results ─────────────────────────────────────────────────

export interface VisionItemInput {
  name?: string;
  portion_g?: number | null;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

/**
 * The model only identifies foods and guesses portions. Where the identified
 * food exists in the reference table its numbers come from the table
 * (`per-100 g × the guessed grams`); only unknown foods keep the model's own
 * numbers, marked "Estimated" and sanity-checked.
 */
export function reconcileVisionItems(raw: readonly VisionItemInput[]): EstimatedItem[] {
  return raw.map((entry) => {
    const name = String(entry.name ?? "").trim() || "food";
    const matches = findMatches(tokenize(name));
    const portion = Number(entry.portion_g);
    const single = matches.length === 1 ? (matches[0] as Match) : null;
    if (single) {
      const hasPortion = Number.isFinite(portion) && portion > 0;
      const item = itemFromFood(
        single.food,
        hasPortion ? portion : single.food.defaultPortionG,
        "assumed",
        [
          hasPortion
            ? `Assumed ${fmtG(portion)} from the photo (a visual guess)`
            : "Assumed a typical serving — the photo didn’t give a portion",
          `Identified from the photo as “${name}”`,
        ],
        single.alias,
      );
      return { ...item, confidence: Math.min(item.confidence ?? 0.5, 0.55) };
    }
    const item: EstimatedItem = {
      label: name,
      grams: Number.isFinite(portion) && portion > 0 ? round1(portion) : null,
      calories: Math.round(Number(entry.calories) || 0),
      protein: round1(Number(entry.protein_g) || 0),
      carbs: round1(Number(entry.carbs_g) || 0),
      fat: round1(Number(entry.fat_g) || 0),
      recognised: true,
      provenance: "estimate",
      sourceNote: "AI estimate from the photo — no matching food in the reference table",
      portionBasis: "assumed",
      assumptions: ["Portion and nutrition are both an AI guess from the photo"],
    };
    return withFlags(item, 0.35);
  });
}
