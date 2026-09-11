import { format, subDays } from "date-fns";

export interface StreakMealLike {
  eaten_at: string;
  protein_g: number | string;
}

export interface DayAgg {
  hasMeal: boolean;
  protein: number;
}

function dayKey(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

/** Groups meals by local calendar day: whether anything was logged, and total protein. */
export function aggregateDailyProtein(meals: StreakMealLike[]): Map<string, DayAgg> {
  const map = new Map<string, DayAgg>();
  for (const meal of meals) {
    const key = dayKey(meal.eaten_at);
    const row = map.get(key) ?? { hasMeal: false, protein: 0 };
    row.hasMeal = true;
    row.protein += Number(meal.protein_g ?? 0);
    map.set(key, row);
  }
  return map;
}

/**
 * Walks backward from today counting consecutive qualifying days. If today
 * doesn't qualify yet but yesterday does, the streak is still "alive" (counted
 * from yesterday) rather than reading as broken before the day is even over.
 */
function currentStreak(hasEntry: (dateKey: string) => boolean, now: Date): number {
  const todayKey = format(now, "yyyy-MM-dd");
  const yesterdayKey = format(subDays(now, 1), "yyyy-MM-dd");

  let cursor: Date | null = null;
  if (hasEntry(todayKey)) cursor = now;
  else if (hasEntry(yesterdayKey)) cursor = subDays(now, 1);
  if (!cursor) return 0;

  let count = 0;
  while (hasEntry(format(cursor, "yyyy-MM-dd"))) {
    count += 1;
    cursor = subDays(cursor, 1);
  }
  return count;
}

export function computeLoggingStreak(dailyTotals: Map<string, DayAgg>, now: Date): number {
  return currentStreak((key) => dailyTotals.get(key)?.hasMeal === true, now);
}

export function computeProteinStreak(
  dailyTotals: Map<string, DayAgg>,
  proteinTarget: number,
  now: Date,
): number {
  if (proteinTarget <= 0) return 0;
  return currentStreak((key) => (dailyTotals.get(key)?.protein ?? 0) >= proteinTarget, now);
}
