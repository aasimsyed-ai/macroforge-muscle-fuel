/**
 * Quantity parsing for typed food descriptions. One parser, used both for the
 * "Serving amount" field and for each phrase of the Food-name field, so the two
 * can never disagree.
 *
 * Priority (first that applies wins):
 *   1. an explicit weight/volume next to a number ("150 g", "1.5 kg", "250 ml")
 *      — always literal, even if a household word is also present;
 *   2. a household measure ("1 bowl", "2 tbsp", "½ cup") → fixed gram table;
 *   3. a bare count ("3 eggs") — resolved by the caller using the food's own
 *      unit weight, never here;
 *   4. a bare number above 20, read as grams.
 *
 * ml/l are treated as 1 g/ml — right for water-like drinks, within a few
 * percent for milk and juice.
 */

export type QuantityBasis = "explicit" | "household";

export interface ParsedQuantity {
  /** Whole-phrase amount in grams, when the text carries a weight/volume/measure. */
  grams: number | null;
  /** Leading count with no unit ("3" in "3 boiled eggs") — for the caller to convert. */
  count: number | null;
  basis: QuantityBasis | null;
  /** The text that produced `grams`, for showing the user how it was read. */
  matched: string | null;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  quarter: 0.25,
};

/** Grams per household measure. These are assumptions, and are reported as such. */
export const HOUSEHOLD_GRAMS: ReadonlyArray<{ pattern: RegExp; grams: number; name: string }> = [
  { pattern: /katoris?/, grams: 150, name: "katori" },
  { pattern: /bowls?/, grams: 250, name: "bowl" },
  { pattern: /(?:glass|tumbler)(?:e?s)?/, grams: 200, name: "glass" },
  { pattern: /cups?/, grams: 200, name: "cup" },
  { pattern: /(?:tbsp|tablespoons?)/, grams: 15, name: "tbsp" },
  { pattern: /(?:tsp|teaspoons?)/, grams: 5, name: "tsp" },
  { pattern: /scoops?/, grams: 30, name: "scoop" },
  { pattern: /(?:plate|thali|serving|serve|portion)s?/, grams: 300, name: "plate" },
  { pattern: /slices?/, grams: 30, name: "slice" },
  { pattern: /(?:pieces?|pcs?)/, grams: 55, name: "piece" },
];

const QTY =
  "(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|a|an)";

const WEIGHT_UNITS: ReadonlyArray<{ pattern: string; factor: number }> = [
  { pattern: "kgs?|kilograms?|kilos?", factor: 1000 },
  { pattern: "gms?|grams?|g", factor: 1 },
  { pattern: "mls?|millilit(?:re|er)s?", factor: 1 },
  { pattern: "litres?|liters?|l", factor: 1000 },
];

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/½/g, " 1/2")
    .replace(/¼/g, " 1/4")
    .replace(/¾/g, " 3/4")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(raw: string): number {
  const s = raw.trim();
  if (s in WORD_NUMBERS) return WORD_NUMBERS[s] as number;
  if (s === "a" || s === "an") return 1;
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? 0 : Number(frac[1]) / Number(frac[2]);
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

export function parseQuantity(text: string): ParsedQuantity {
  const s = normalise(text);
  const none: ParsedQuantity = { grams: null, count: null, basis: null, matched: null };
  if (!s) return none;

  // 1. explicit weight / volume — the number must sit directly against the unit.
  for (const { pattern, factor } of WEIGHT_UNITS) {
    const re = new RegExp(
      `(?:^|[^a-z0-9.])(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\s*(?:${pattern})(?![a-z])`,
    );
    const m = s.match(re);
    if (m?.[1] !== undefined) {
      const grams = toNumber(m[1]) * factor;
      if (grams > 0) return { grams, count: null, basis: "explicit", matched: m[0].trim() };
    }
  }

  // 2. household measure, optionally preceded by a quantity ("½ cup", "two bowls", "a glass").
  for (const { pattern, grams } of HOUSEHOLD_GRAMS) {
    const re = new RegExp(
      `(?:^|[^a-z0-9])(?:${QTY}\\s+(?:(?:of|a|an)\\s+)?)?(?:${pattern.source})(?![a-z])`,
    );
    const m = s.match(re);
    if (m) {
      const qty = m[1] !== undefined ? toNumber(m[1]) : 1;
      if (qty > 0)
        return { grams: qty * grams, count: null, basis: "household", matched: m[0].trim() };
    }
  }

  // 3./4. bare number — a count unless it is clearly a weight.
  const bare = s.match(/(?:^|[^a-z0-9./])(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?![a-z0-9/])/);
  const words = s.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\b/);
  const raw = bare?.[1] ?? words?.[1];
  if (raw !== undefined) {
    const value = toNumber(raw);
    if (value > 20) return { grams: value, count: null, basis: "explicit", matched: raw };
    if (value > 0) return { ...none, count: value };
  }
  return none;
}

/**
 * Parses "200g", "1.5 cups", "2 rotis", "1 bowl" into an approximate gram
 * weight, for the Serving-amount field (no food is known here, so a count of
 * eggs or rotis uses a generic per-item weight).
 */
export function parseServingToGrams(serving: string): number | null {
  const q = parseQuantity(serving);
  if (q.grams != null) return q.grams;
  if (q.count != null) {
    const s = serving.toLowerCase();
    if (/\beggs?\b/.test(s)) return q.count * 50;
    if (/\b(rotis?|chapatis?|phulkas?|parathas?|dosas?|idlis?)\b/.test(s)) return q.count * 55;
  }
  return null;
}

/**
 * Splits "oats + banana, 2 eggs and toast" into individual items. Fractions
 * ("1/2 cup") and thousands separators ("1,000 kcal") are left alone.
 */
export function splitItems(text: string): string[] {
  return text
    .split(/\s*(?:\+|;|,(?!\d)|\s\/\s|&|\band\b)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
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
