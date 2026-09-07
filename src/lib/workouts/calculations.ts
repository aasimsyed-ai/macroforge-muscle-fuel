import { INDIAN_GYM_WEIGHTS_KG, INTENSITIES } from "./constants";
import type { TrainingPreferences, WorkoutIntensity, WorkoutSetDraft } from "./types";

export function calculateSetVolume(
  set: Pick<WorkoutSetDraft, "reps" | "weightKg" | "weightMode" | "completed">,
): number {
  if (!set.completed || set.reps <= 0) {
    return 0;
  }

  if (
    set.weightMode === "bodyweight" ||
    set.weightKg === null ||
    !Number.isFinite(set.weightKg)
  ) {
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
