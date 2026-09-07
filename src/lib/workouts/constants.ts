import type { TrainingPhase, TrainingPreferences, WeightMode, WorkoutIntensity } from "./types";

/** Weight plates / dumbbells commonly available in Indian gyms, ascending. */
export const INDIAN_GYM_WEIGHTS_KG = [
  2, 2.5, 3, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50,
] as const;

/**
 * MET values for resistance training by perceived intensity. Used with the
 * standard `MET * 3.5 * kg / 200` kcal/min estimate. These are approximate.
 */
export const INTENSITIES: ReadonlyArray<{
  value: WorkoutIntensity;
  label: string;
  met: number;
}> = [
  { value: "light", label: "Light", met: 3.5 },
  { value: "moderate", label: "Moderate", met: 5 },
  { value: "vigorous", label: "Vigorous", met: 7 },
];

export const TRAINING_PHASES: ReadonlyArray<{ value: TrainingPhase; label: string }> = [
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "strength", label: "Strength" },
  { value: "fat_loss", label: "Fat loss" },
  { value: "general_fitness", label: "General fitness" },
  { value: "endurance", label: "Endurance" },
  { value: "maintenance", label: "Maintenance" },
  { value: "custom", label: "Custom" },
];

export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Glutes",
  "Core",
  "Full Body",
  "Other",
] as const;

export const WEIGHT_MODES: ReadonlyArray<{ value: WeightMode; label: string }> = [
  { value: "external", label: "External load" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "total", label: "Total load" },
  { value: "custom", label: "Custom" },
];

export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  trainingPhase: "hypertrophy",
  experienceLevel: null,
  progressionMode: "double_progression",
  targetMinReps: 8,
  targetMaxReps: 12,
  targetSets: 3,
  minimumSessionsForSuggestion: 4,
  minimumWeeksForSuggestion: 3,
};

export const EXPERIENCE_DISCLAIMER =
  "This is an estimate based on logged training history and may change as more data becomes available.";

export const PROGRESSION_INSUFFICIENT_MESSAGE =
  "More data is needed before making a progression recommendation.";
