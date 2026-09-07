import type { WorkoutExerciseDraft, WorkoutSessionDraft, WorkoutSetDraft } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function isPositiveInt(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

/** A set is "usable" when it has valid reps and (where required) a valid weight. */
export function isValidSet(set: WorkoutSetDraft): boolean {
  return validateSet(set).length === 0;
}

export function validateSet(set: WorkoutSetDraft): string[] {
  const errors: string[] = [];

  if (!isPositiveInt(set.reps) || set.reps > 1000) {
    errors.push("Reps must be a whole number between 1 and 1000.");
  }

  const needsWeight =
    set.weightMode === "external" || set.weightMode === "total" || set.weightMode === "custom";

  if (needsWeight) {
    if (set.weightKg === null || !Number.isFinite(set.weightKg) || set.weightKg < 0) {
      errors.push("Enter a weight of 0 kg or more for this set.");
    }
  } else if (set.weightKg !== null && (!Number.isFinite(set.weightKg) || set.weightKg < 0)) {
    // bodyweight set with optional added load
    errors.push("Added weight must be 0 kg or more.");
  }

  if (set.rir !== null && (!Number.isFinite(set.rir) || set.rir < 0 || set.rir > 10)) {
    errors.push("RIR must be between 0 and 10.");
  }

  if (set.rpe !== null && (!Number.isFinite(set.rpe) || set.rpe < 1 || set.rpe > 10)) {
    errors.push("RPE must be between 1 and 10.");
  }

  if (
    set.restSeconds !== null &&
    (!Number.isFinite(set.restSeconds) || set.restSeconds < 0 || set.restSeconds > 3600)
  ) {
    errors.push("Rest must be between 0 and 3600 seconds.");
  }

  return errors;
}

export function validateExercise(exercise: WorkoutExerciseDraft): string[] {
  const errors: string[] = [];

  if (!exercise.exerciseName.trim()) {
    errors.push("Every exercise needs a name.");
  }

  const usableSets = exercise.sets.filter((set) => isValidSet(set));
  if (usableSets.length === 0) {
    errors.push(`"${exercise.exerciseName || "Exercise"}" needs at least one valid set.`);
  }

  return errors;
}

export function validateWorkoutDraft(draft: WorkoutSessionDraft): ValidationResult {
  const errors: string[] = [];

  if (!draft.workoutDate) {
    errors.push("Pick a workout date.");
  }

  if (
    draft.durationMinutes !== null &&
    (!Number.isFinite(draft.durationMinutes) ||
      draft.durationMinutes < 0 ||
      draft.durationMinutes > 1440)
  ) {
    errors.push("Duration must be between 0 and 1440 minutes.");
  }

  if (
    draft.averageHeartRate !== null &&
    (!Number.isFinite(draft.averageHeartRate) ||
      draft.averageHeartRate < 30 ||
      draft.averageHeartRate > 240)
  ) {
    errors.push("Average heart rate looks out of range.");
  }

  if (
    draft.maxHeartRate !== null &&
    (!Number.isFinite(draft.maxHeartRate) || draft.maxHeartRate < 30 || draft.maxHeartRate > 260)
  ) {
    errors.push("Max heart rate looks out of range.");
  }

  if (
    draft.wearableCaloriesBurned !== null &&
    (!Number.isFinite(draft.wearableCaloriesBurned) || draft.wearableCaloriesBurned < 0)
  ) {
    errors.push("Wearable calories must be 0 or more.");
  }

  if (draft.exercises.length === 0) {
    errors.push("Add at least one exercise.");
  }

  for (const exercise of draft.exercises) {
    errors.push(...validateExercise(exercise));
  }

  return { ok: errors.length === 0, errors };
}
