export type WorkoutIntensity = "light" | "moderate" | "vigorous";

export type TrainingPhase =
  | "hypertrophy"
  | "strength"
  | "fat_loss"
  | "general_fitness"
  | "endurance"
  | "maintenance"
  | "custom";

export type DataSource = "manual" | "wearable" | "estimated" | "imported";

export type WeightMode = "external" | "bodyweight" | "total" | "custom";

export type ProgressionResult =
  | "ready_to_progress"
  | "maintain"
  | "deload_or_recover"
  | "insufficient_data";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface ExerciseCatalogItem {
  id: string;
  muscle_group: string;
  name: string;
  variant: string | null;
  equipment: string | null;
  is_bodyweight: boolean;
  is_active: boolean;
}

export interface WorkoutSetDraft {
  setNumber: number;
  reps: number;
  weightKg: number | null;
  weightMode: WeightMode;
  rir: number | null;
  rpe: number | null;
  completed: boolean;
  restSeconds: number | null;
}

export interface WorkoutExerciseDraft {
  muscleGroup: string;
  exerciseName: string;
  exerciseVariant: string | null;
  equipment: string | null;
  exerciseCatalogId: string | null;
  isBodyweight: boolean;
  sets: WorkoutSetDraft[];
}

export interface WorkoutSessionDraft {
  workoutDate: string;
  durationMinutes: number | null;
  intensity: WorkoutIntensity;
  trainingPhase: TrainingPhase;
  notes: string;
  wearableCaloriesBurned: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  exercises: WorkoutExerciseDraft[];
}

export interface WorkoutSessionRecord {
  id: string;
  user_id: string;
  workout_date: string;
  duration_minutes: number | null;
  intensity: WorkoutIntensity | null;
  training_phase: TrainingPhase | null;
  estimated_calories_burned: number | null;
  wearable_calories_burned: number | null;
  calories_source: DataSource | null;
  average_heart_rate: number | null;
  max_heart_rate: number | null;
  total_volume: number;
  notes: string | null;
  source: DataSource;
  created_at: string;
}

export interface TrainingPreferences {
  trainingPhase: TrainingPhase;
  experienceLevel: ExperienceLevel | null;
  progressionMode: "double_progression" | "weight_first" | "reps_first";
  targetMinReps: number;
  targetMaxReps: number;
  targetSets: number;
  minimumSessionsForSuggestion: number;
  minimumWeeksForSuggestion: number;
}
