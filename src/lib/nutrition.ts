import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

export type MealCategory =
  | "breakfast"
  | "lunch"
  | "pre_workout"
  | "post_workout"
  | "dinner"
  | "snack";

export const MEAL_CATEGORIES: { value: MealCategory; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "pre_workout", label: "Pre-workout" },
  { value: "post_workout", label: "Post-workout" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function categoryLabel(value: string): string {
  return MEAL_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const GOAL_TYPES = [
  { value: "lean_bulk", label: "Lean bulk (gradual gain)" },
  { value: "recomp", label: "Body recomposition" },
  { value: "maintain", label: "Maintain weight" },
  { value: "cut", label: "Cut (fat loss)" },
];

export type RangeKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom range" },
];

export type DateRange = { from: Date; to: Date; days: number; label: string };

const WEEK_OPTS = { weekStartsOn: 1 } as const;

export function resolveRange(key: RangeKey, custom?: { from?: string; to?: string }): DateRange {
  const now = new Date();
  let from: Date;
  let to: Date;
  let label: string;

  switch (key) {
    case "yesterday": {
      const d = subDays(now, 1);
      from = startOfDay(d);
      to = endOfDay(d);
      label = "Yesterday";
      break;
    }
    case "this_week":
      from = startOfWeek(now, WEEK_OPTS);
      to = endOfDay(now);
      label = "This Week";
      break;
    case "last_week": {
      const d = subWeeks(now, 1);
      from = startOfWeek(d, WEEK_OPTS);
      to = endOfWeek(d, WEEK_OPTS);
      label = "Last Week";
      break;
    }
    case "this_month":
      from = startOfMonth(now);
      to = endOfDay(now);
      label = "This Month";
      break;
    case "last_month": {
      const d = subMonths(now, 1);
      from = startOfMonth(d);
      to = endOfMonth(d);
      label = "Last Month";
      break;
    }
    case "custom": {
      const f = custom?.from ? new Date(`${custom.from}T00:00:00`) : subDays(now, 6);
      const t = custom?.to ? new Date(`${custom.to}T00:00:00`) : now;
      from = startOfDay(f);
      to = endOfDay(t);
      label = "Custom range";
      break;
    }
    case "today":
    default:
      from = startOfDay(now);
      to = endOfDay(now);
      label = "Today";
  }

  const days = Math.max(1, Math.round((endOfDay(to).getTime() - from.getTime()) / 86_400_000));
  return { from, to, days, label };
}

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
};

export const emptyTotals: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };

export type MealLike = {
  calories: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
};

export function sumMeals(meals: MealLike[] | undefined): MacroTotals {
  if (!meals?.length) return { ...emptyTotals };
  return meals.reduce<MacroTotals>(
    (acc, m) => ({
      calories: acc.calories + Number(m.calories ?? 0),
      protein: acc.protein + Number(m.protein_g ?? 0),
      carbs: acc.carbs + Number(m.carbs_g ?? 0),
      fat: acc.fat + Number(m.fat_g ?? 0),
      count: acc.count + 1,
    }),
    { ...emptyTotals },
  );
}

export function pct(value: number, target: number): number {
  if (!target) return 0;
  return Math.max(0, Math.min(150, (value / target) * 100));
}

export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return round(protein * 4 + carbs * 4 + fat * 9);
}

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm) return null;
  return round(weightKg / (heightCm / 100) ** 2, 1);
}

/** Mifflin-St Jeor BMR + light activity multiplier, used to sanity-check targets. */
export function suggestedCalories(opts: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex?: string | null;
  goalType?: string;
}): number | null {
  const { weightKg, heightCm, age } = opts;
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age + (opts.sex === "female" ? -161 : 5);
  const tdee = base * 1.55;
  const surplus =
    opts.goalType === "cut" ? -400 : opts.goalType === "maintain" ? 0 : opts.goalType === "recomp" ? 100 : 350;
  return Math.round((tdee + surplus) / 10) * 10;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
