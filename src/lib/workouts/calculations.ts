import { INDIAN_GYM_WEIGHTS_KG, INTENSITIES } from "./constants";
import type { TrainingPreferences, WeightMode, WorkoutIntensity, WorkoutSetDraft } from "./types";

export function calculateSetVolume(
  set: Pick<WorkoutSetDraft, "reps" | "weightKg" | "weightMode" | "completed">,
): number {
  if (!set.completed || set.reps <= 0) {
    return 0;
  }

  if (set.weightMode === "bodyweight" || set.weightKg === null || !Number.isFinite(set.weightKg)) {
    return 0;
  }

  return set.reps * set.weightKg;
}

export function calculateSessionVolume(
  exercises: Array<{
    sets: Array<Pick<WorkoutSetDraft, "reps" | "weightKg" | "weightMode" | "completed">>;
  }>,
): number {
  return exercises.reduce(
    (exerciseTotal, exercise) =>
      exerciseTotal +
      exercise.sets.reduce((setTotal, set) => setTotal + calculateSetVolume(set), 0),
    0,
  );
}

export interface CalorieEstimateInput {
  bodyWeightKg: number | null;
  durationMinutes: number | null;
  intensity: WorkoutIntensity | null;
  averageHeartRate: number | null;
  wearableCalories: number | null;
}

export interface CalorieEstimate {
  calories: number | null;
  source: "wearable" | "estimated" | "unavailable";
}

export function calculateWorkoutCalories(input: CalorieEstimateInput): CalorieEstimate {
  if (
    input.wearableCalories !== null &&
    Number.isFinite(input.wearableCalories) &&
    input.wearableCalories > 0
  ) {
    return { calories: Math.round(input.wearableCalories), source: "wearable" };
  }

  if (
    input.bodyWeightKg === null ||
    input.bodyWeightKg <= 0 ||
    input.durationMinutes === null ||
    input.durationMinutes <= 0 ||
    input.intensity === null
  ) {
    return { calories: null, source: "unavailable" };
  }

  const intensity = INTENSITIES.find((item) => item.value === input.intensity);

  if (!intensity) {
    return { calories: null, source: "unavailable" };
  }

  let heartRateFactor = 1;

  if (
    input.averageHeartRate !== null &&
    input.averageHeartRate >= 80 &&
    input.averageHeartRate <= 220
  ) {
    const normalizedHeartRate = (input.averageHeartRate - 80) / 140;
    heartRateFactor = Math.min(1.15, Math.max(0.85, 0.9 + normalizedHeartRate * 0.2));
  }

  const calories =
    ((intensity.met * 3.5 * input.bodyWeightKg) / 200) * input.durationMinutes * heartRateFactor;

  return { calories: Math.max(0, Math.round(calories)), source: "estimated" };
}

export function getNextAvailableWeight(
  currentWeight: number,
  availableWeights: readonly number[] = INDIAN_GYM_WEIGHTS_KG,
): number | null {
  return availableWeights.find((weight) => weight > currentWeight) ?? null;
}

export function weeksBetween(firstDate: string, lastDate: string): number {
  const first = new Date(firstDate).getTime();
  const last = new Date(lastDate).getTime();

  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return 0;
  }

  return Math.max(0, (last - first) / 604800000);
}

export function calculateExperienceLevel(input: {
  consistentWeeks: number;
  completedSessions: number;
  hasProgressionEvidence: boolean;
}): {
  level: "beginner" | "intermediate" | "advanced" | null;
  reason: string;
} {
  if (input.completedSessions < 5 || input.consistentWeeks < 4) {
    return { level: null, reason: "Not enough training history yet." };
  }

  if (
    input.consistentWeeks >= 52 &&
    input.completedSessions >= 100 &&
    input.hasProgressionEvidence
  ) {
    return {
      level: "advanced",
      reason: "Based on long-term consistency and progression evidence.",
    };
  }

  if (input.consistentWeeks >= 12 && input.completedSessions >= 20) {
    return {
      level: "intermediate",
      reason: "Based on several months of consistent training.",
    };
  }

  return {
    level: "beginner",
    reason: "You are still building your training foundation.",
  };
}

export interface ProgressionHistoryItem {
  sessionDate: string;
  weightKg: number | null;
  completedSets: number;
  totalSets: number;
  maxReps: number;
  totalVolume: number;
  averageRir: number | null;
}

export interface ProgressionAnalysis {
  result: "ready_to_progress" | "maintain" | "deload_or_recover" | "insufficient_data";
  confidence: "low" | "medium" | "high";
  suggestedWeightKg: number | null;
  explanation: string;
}

export function analyzeExerciseProgression(
  history: ProgressionHistoryItem[],
  preferences: TrainingPreferences,
): ProgressionAnalysis {
  const sorted = [...history].sort(
    (a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime(),
  );

  if (sorted.length < preferences.minimumSessionsForSuggestion) {
    return {
      result: "insufficient_data",
      confidence: "low",
      suggestedWeightKg: null,
      explanation: "More completed sessions are needed before suggesting progression.",
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (!first || !last) {
    return {
      result: "insufficient_data",
      confidence: "low",
      suggestedWeightKg: null,
      explanation: "More completed sessions are needed before suggesting progression.",
    };
  }

  if (weeksBetween(first.sessionDate, last.sessionDate) < preferences.minimumWeeksForSuggestion) {
    return {
      result: "insufficient_data",
      confidence: "low",
      suggestedWeightKg: null,
      explanation: "Keep logging this exercise across more weeks before changing the load.",
    };
  }

  const recent = sorted.slice(-4);
  const latestWeight = recent[recent.length - 1]?.weightKg ?? null;

  const sameLoadSessions = recent.filter((item) => item.weightKg === latestWeight);

  if (sameLoadSessions.length < 3) {
    return {
      result: "insufficient_data",
      confidence: "low",
      suggestedWeightKg: null,
      explanation:
        "More repeated sessions at the same weight are needed for a reliable recommendation.",
    };
  }

  const completionRate =
    sameLoadSessions.reduce(
      (sum, item) => sum + (item.totalSets > 0 ? item.completedSets / item.totalSets : 0),
      0,
    ) / sameLoadSessions.length;

  const rirValues = sameLoadSessions
    .map((item) => item.averageRir)
    .filter((value): value is number => value !== null);

  const recoveryConcern =
    completionRate < 0.75 ||
    (rirValues.length >= 2 && rirValues.slice(-2).every((rir) => rir <= 0));

  if (recoveryConcern) {
    return {
      result: "deload_or_recover",
      confidence: "medium",
      suggestedWeightKg: null,
      explanation:
        "Recent sessions show reduced completion or very high effort. Maintain or reduce the load and prioritize recovery.",
    };
  }

  const reachedTopRange = sameLoadSessions.every(
    (item) =>
      item.completedSets >= preferences.targetSets && item.maxReps >= preferences.targetMaxReps,
  );

  if (reachedTopRange && latestWeight !== null) {
    const nextWeight = getNextAvailableWeight(latestWeight);

    return {
      result: "ready_to_progress",
      confidence: "high",
      suggestedWeightKg: nextWeight,
      explanation: nextWeight
        ? `You reached the top of your target range across several sessions. Try ${nextWeight} kg next session and return to the lower end of the rep range.`
        : "You reached the top of your target range. Continue controlled repetitions or use a small custom increase if available.",
    };
  }

  return {
    result: "maintain",
    confidence: "medium",
    suggestedWeightKg: null,
    explanation:
      "Keep the current load and work toward the top of your target rep range with controlled form.",
  };
}

/* --------------------- week/month progressive-overload board -------------------- */

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface ExercisePeriodStats {
  completedSets: number;
  totalSets: number;
  totalVolume: number;
  /** Max external-load weight among completed sets that tracked one; null when
   * every completed set was pure bodyweight (no added load). */
  topWeightKg: number | null;
  /** Average reps across the completed sets performed at `topWeightKg`. */
  repsAtTopWeight: number | null;
  /** Average reps across every completed set — the bodyweight comparison fallback. */
  averageReps: number | null;
}

const EMPTY_PERIOD_STATS: Omit<ExercisePeriodStats, "totalSets"> = {
  completedSets: 0,
  totalVolume: 0,
  topWeightKg: null,
  repsAtTopWeight: null,
  averageReps: null,
};

/** Reduces one exercise's sets within a single period into comparable stats. Pure. */
export function summarizeExercisePeriod(
  sets: ReadonlyArray<{
    reps: number;
    weightKg: number | null;
    weightMode: WeightMode;
    completed: boolean;
  }>,
): ExercisePeriodStats {
  const totalSets = sets.length;
  const completed = sets.filter((set) => set.completed);
  if (completed.length === 0) {
    return { ...EMPTY_PERIOD_STATS, totalSets };
  }

  const totalVolume = completed.reduce((sum, set) => sum + calculateSetVolume(set), 0);

  const weighted = completed.filter(
    (set) =>
      set.weightMode !== "bodyweight" && set.weightKg !== null && Number.isFinite(set.weightKg),
  );
  const topWeightKg = weighted.length
    ? Math.max(...weighted.map((set) => set.weightKg as number))
    : null;
  const atTopWeight =
    topWeightKg !== null ? weighted.filter((set) => set.weightKg === topWeightKg) : [];
  const repsAtTopWeight = atTopWeight.length
    ? round1(atTopWeight.reduce((sum, set) => sum + set.reps, 0) / atTopWeight.length)
    : null;
  const averageReps = round1(completed.reduce((sum, set) => sum + set.reps, 0) / completed.length);

  return {
    completedSets: completed.length,
    totalSets,
    totalVolume,
    topWeightKg,
    repsAtTopWeight,
    averageReps,
  };
}

export type ExerciseProgressStatus =
  "progressed" | "maintained" | "decreased" | "insufficient_data";

export interface ExerciseProgressComparison {
  status: ExerciseProgressStatus;
  explanation: string;
  changeWeightKg: number | null;
  changeReps: number | null;
  changeSets: number | null;
}

/**
 * Compares one exercise's stats between two periods and classifies progress.
 * Deliberately does NOT use total volume as the deciding signal — progressive
 * overload can come from more weight, more reps at the same weight, or more
 * sets, checked in that order (each only decides once the one before it is
 * tied), matching how lifters actually think about progression. Pure —
 * comparisons are always against the two stats objects passed in, never
 * against any other exercise or muscle group, so nothing here can suppress
 * or gate a different exercise's own comparison.
 */
export function compareExercisePeriods(
  current: ExercisePeriodStats,
  previous: ExercisePeriodStats,
): ExerciseProgressComparison {
  const none = (explanation: string): ExerciseProgressComparison => ({
    status: "insufficient_data",
    explanation,
    changeWeightKg: null,
    changeReps: null,
    changeSets: null,
  });

  if (current.completedSets === 0) {
    return none("No completed sets logged for this exercise in this period.");
  }
  if (previous.completedSets === 0) {
    return none("No comparable data from the previous period yet.");
  }

  const changeSets = current.completedSets - previous.completedSets;

  if (current.topWeightKg !== null && previous.topWeightKg !== null) {
    const changeWeightKg = round1(current.topWeightKg - previous.topWeightKg);
    if (changeWeightKg > 0) {
      return {
        status: "progressed",
        explanation: `Working weight up ${previous.topWeightKg} → ${current.topWeightKg} kg.`,
        changeWeightKg,
        changeReps: null,
        changeSets: null,
      };
    }
    if (changeWeightKg < 0) {
      return {
        status: "decreased",
        explanation: `Working weight down ${previous.topWeightKg} → ${current.topWeightKg} kg.`,
        changeWeightKg,
        changeReps: null,
        changeSets: null,
      };
    }

    const curReps = current.repsAtTopWeight ?? 0;
    const prevReps = previous.repsAtTopWeight ?? 0;
    const changeReps = round1(curReps - prevReps);
    if (changeReps > 0) {
      return {
        status: "progressed",
        explanation: `Same weight (${current.topWeightKg} kg), reps up ${previous.repsAtTopWeight} → ${current.repsAtTopWeight}.`,
        changeWeightKg: 0,
        changeReps,
        changeSets: null,
      };
    }
    if (changeReps < 0) {
      return {
        status: "decreased",
        explanation: `Same weight (${current.topWeightKg} kg), reps down ${previous.repsAtTopWeight} → ${current.repsAtTopWeight}.`,
        changeWeightKg: 0,
        changeReps,
        changeSets: null,
      };
    }

    if (changeSets > 0) {
      return {
        status: "progressed",
        explanation: `Same weight and reps, but more sets (${current.completedSets} vs ${previous.completedSets}).`,
        changeWeightKg: 0,
        changeReps: 0,
        changeSets,
      };
    }
    if (changeSets < 0) {
      return {
        status: "decreased",
        explanation: `Same weight and reps, but fewer sets (${current.completedSets} vs ${previous.completedSets}).`,
        changeWeightKg: 0,
        changeReps: 0,
        changeSets,
      };
    }
    return {
      status: "maintained",
      explanation: "Same weight, reps and sets as last time.",
      changeWeightKg: 0,
      changeReps: 0,
      changeSets: 0,
    };
  }

  // No external load tracked on one or both sides (e.g. bodyweight) — compare
  // reps, then sets, the same way a bodyweight lifter actually progresses.
  const curReps = current.averageReps ?? 0;
  const prevReps = previous.averageReps ?? 0;
  const changeReps = round1(curReps - prevReps);
  if (changeReps > 0) {
    return {
      status: "progressed",
      explanation: `Average reps up ${previous.averageReps} → ${current.averageReps}.`,
      changeWeightKg: null,
      changeReps,
      changeSets: null,
    };
  }
  if (changeReps < 0) {
    return {
      status: "decreased",
      explanation: `Average reps down ${previous.averageReps} → ${current.averageReps}.`,
      changeWeightKg: null,
      changeReps,
      changeSets: null,
    };
  }
  if (changeSets > 0) {
    return {
      status: "progressed",
      explanation: `Same reps, more sets (${current.completedSets} vs ${previous.completedSets}).`,
      changeWeightKg: null,
      changeReps: 0,
      changeSets,
    };
  }
  if (changeSets < 0) {
    return {
      status: "decreased",
      explanation: `Same reps, fewer sets (${current.completedSets} vs ${previous.completedSets}).`,
      changeWeightKg: null,
      changeReps: 0,
      changeSets,
    };
  }
  return {
    status: "maintained",
    explanation: "Same reps and sets as last time.",
    changeWeightKg: null,
    changeReps: 0,
    changeSets: 0,
  };
}

export type ProgressBoardPeriod = "this_week" | "last_week" | "this_month";

export interface ProgressBoardWindow {
  currentFrom: string;
  currentTo: string;
  previousFrom: string;
  previousTo: string;
  label: string;
}

// Local-calendar-day key (not toISOString, which is UTC and can land on the
// wrong day for anyone east of UTC near midnight) — matches how the rest of
// the app keys dates (nutrition.ts's resolveRange uses date-fns format() on
// local Date objects for the same reason).
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Resolves the two comparable windows for a board period, always comparing
 * against the immediately-preceding period of the same length. Takes `now`
 * explicitly (rather than reading the clock internally) so it's testable.
 */
export function resolveProgressBoardWindow(
  period: ProgressBoardPeriod,
  now: Date,
): ProgressBoardWindow {
  if (period === "this_week") {
    const from = mondayOf(now);
    const prevFrom = addDays(from, -7);
    const prevTo = addDays(from, -1);
    return {
      currentFrom: toDateKey(from),
      currentTo: toDateKey(now),
      previousFrom: toDateKey(prevFrom),
      previousTo: toDateKey(prevTo),
      label: "This week vs last week",
    };
  }
  if (period === "last_week") {
    const thisMonday = mondayOf(now);
    const from = addDays(thisMonday, -7);
    const to = addDays(thisMonday, -1);
    const prevFrom = addDays(from, -7);
    const prevTo = addDays(from, -1);
    return {
      currentFrom: toDateKey(from),
      currentTo: toDateKey(to),
      previousFrom: toDateKey(prevFrom),
      previousTo: toDateKey(prevTo),
      label: "Last week vs the week before",
    };
  }
  const from = startOfCalendarMonth(now);
  const prevMonthAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevFrom = startOfCalendarMonth(prevMonthAnchor);
  const prevTo = endOfCalendarMonth(prevMonthAnchor);
  return {
    currentFrom: toDateKey(from),
    currentTo: toDateKey(now),
    previousFrom: toDateKey(prevFrom),
    previousTo: toDateKey(prevTo),
    label: "This month vs last month",
  };
}
