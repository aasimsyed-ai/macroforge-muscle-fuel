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

/** Common gym equipment — offered as a dropdown, but the field still accepts free text. */
export const EQUIPMENT_OPTIONS = [
  "Barbell",
  "Dumbbell",
  "Machine",
  "Cable",
  "Smith Machine",
  "Kettlebell",
  "EZ Bar",
  "Resistance Band",
  "Bodyweight",
] as const;

/** Common exercise variants — offered as a dropdown, but the field still accepts free text. */
export const VARIANT_OPTIONS = [
  "Flat",
  "Incline",
  "Decline",
  "Close-Grip",
  "Wide-Grip",
  "Single-Arm",
  "Seated",
  "Standing",
  "Paused",
  "Reverse-Grip",
  "Sumo",
  "Deficit",
] as const;

/** Which VARIANT_OPTIONS make sense for each muscle group — e.g. "Flat/Incline/Decline"
 * only ever applies to chest presses, not curls or rows. Falls back to the full list
 * for a muscle group not listed here (e.g. "Other") rather than hiding anything. */
const MUSCLE_GROUP_VARIANTS: Partial<Record<(typeof MUSCLE_GROUPS)[number], readonly string[]>> = {
  Chest: ["Flat", "Incline", "Decline", "Close-Grip", "Wide-Grip", "Single-Arm", "Paused"],
  Back: ["Wide-Grip", "Close-Grip", "Single-Arm", "Seated", "Standing", "Reverse-Grip", "Paused"],
  Shoulders: ["Seated", "Standing", "Single-Arm", "Wide-Grip"],
  Biceps: ["Wide-Grip", "Close-Grip", "Reverse-Grip", "Seated", "Standing", "Single-Arm"],
  Triceps: ["Close-Grip", "Reverse-Grip", "Single-Arm", "Seated", "Standing"],
  Legs: [
    "Sumo",
    "Wide-Grip",
    "Close-Grip",
    "Paused",
    "Single-Arm",
    "Deficit",
    "Seated",
    "Standing",
  ],
  Glutes: ["Single-Arm", "Standing", "Seated"],
  Core: ["Standing", "Seated"],
  "Full Body": ["Sumo", "Deficit", "Single-Arm"],
};

/**
 * Variant options relevant to a specific exercise: starts from the muscle
 * group's usual subset, then drops any variant already implied by the
 * exercise's own name (e.g. "Standing Lat Pulldown" shouldn't also offer
 * "Standing" as a separate variant pick — it'd just be redundant).
 */
export function getVariantOptionsFor(muscleGroup: string, exerciseName: string): readonly string[] {
  const base =
    MUSCLE_GROUP_VARIANTS[muscleGroup as (typeof MUSCLE_GROUPS)[number]] ?? VARIANT_OPTIONS;
  const name = exerciseName.toLowerCase();
  return base.filter((variant) => !name.includes(variant.toLowerCase()));
}

/** Equipment keywords found in an exercise's own name — checked in order, first match wins. */
const EQUIPMENT_NAME_HINTS: ReadonlyArray<{ keywords: string[]; options: readonly string[] }> = [
  { keywords: ["smith machine"], options: ["Smith Machine"] },
  { keywords: ["machine"], options: ["Machine"] },
  { keywords: ["cable"], options: ["Cable"] },
  { keywords: ["ez bar", "ez-bar"], options: ["EZ Bar", "Barbell"] },
  { keywords: ["barbell"], options: ["Barbell", "EZ Bar"] },
  { keywords: ["dumbbell"], options: ["Dumbbell"] },
  { keywords: ["kettlebell"], options: ["Kettlebell"] },
  { keywords: ["band"], options: ["Resistance Band"] },
];

/**
 * Equipment options relevant to a specific exercise: a bodyweight exercise
 * (per the catalog's `is_bodyweight` flag) only offers "Bodyweight"; otherwise
 * a keyword found in the exercise's own name (e.g. "Cable Crossover" ->
 * Cable) narrows the list. Falls back to every option for names that don't
 * name their own equipment (e.g. "Row", "Squat") rather than guessing wrong.
 */
export function getEquipmentOptionsFor(
  exerciseName: string,
  isBodyweight: boolean,
): readonly string[] {
  if (isBodyweight) return ["Bodyweight"];
  const name = exerciseName.toLowerCase();
  const hint = EQUIPMENT_NAME_HINTS.find((h) => h.keywords.some((k) => name.includes(k)));
  return hint?.options ?? EQUIPMENT_OPTIONS;
}

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
