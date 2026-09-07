import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

import {
  calculateSessionVolume,
  calculateWorkoutCalories,
  type ProgressionHistoryItem,
} from "./calculations";
import type {
  ExerciseCatalogItem,
  ExperienceLevel,
  TrainingPreferences,
  WorkoutSessionDraft,
  WorkoutSessionRecord,
} from "./types";

type SessionRow = Database["public"]["Tables"]["workout_sessions"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["workout_exercises"]["Row"];
type SetRow = Database["public"]["Tables"]["workout_sets"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type PreferencesRow = Database["public"]["Tables"]["user_training_preferences"]["Row"];

export type WorkoutSession = SessionRow;
export type WorkoutNotification = NotificationRow;
export interface WorkoutSessionDetail extends SessionRow {
  exercises: Array<ExerciseRow & { sets: SetRow[] }>;
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Please sign in to track workouts.");
  }
  return data.user;
}

/* ------------------------------ exercise catalog --------------------------- */

export async function fetchExerciseCatalog(): Promise<ExerciseCatalogItem[]> {
  await requireUser();
  const { data, error } = await supabase
    .from("exercise_catalog")
    .select("id, muscle_group, name, variant, equipment, is_bodyweight, is_active")
    .eq("is_active", true)
    .order("muscle_group", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* --------------------------------- sessions -------------------------------- */

export async function fetchWorkoutSessions(fromDate: string, toDate: string): Promise<SessionRow[]> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("workout_date", fromDate)
    .lte("workout_date", toDate)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchWorkoutSessionById(id: string): Promise<WorkoutSessionDetail | null> {
  const user = await requireUser();
  const { data: session, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from("workout_exercises")
    .select("*")
    .eq("session_id", id)
    .order("exercise_order", { ascending: true });
  if (exerciseError) throw exerciseError;

  const exercises = exerciseRows ?? [];
  const exerciseIds = exercises.map((row) => row.id);

  let sets: SetRow[] = [];
  if (exerciseIds.length > 0) {
    const { data: setRows, error: setError } = await supabase
      .from("workout_sets")
      .select("*")
      .in("workout_exercise_id", exerciseIds)
      .order("set_number", { ascending: true });
    if (setError) throw setError;
    sets = setRows ?? [];
  }

  return {
    ...session,
    exercises: exercises.map((row) => ({
      ...row,
      sets: sets.filter((set) => set.workout_exercise_id === row.id),
    })),
  };
}

export async function createWorkoutSession(
  draft: WorkoutSessionDraft,
  bodyWeightKg: number | null,
): Promise<WorkoutSessionRecord> {
  await requireUser();

  const totalVolume = calculateSessionVolume(
    draft.exercises.map((exercise) => ({
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        weightKg: set.weightKg,
        weightMode: set.weightMode,
        completed: set.completed,
      })),
    })),
  );

  const calorieEstimate = calculateWorkoutCalories({
    bodyWeightKg,
    durationMinutes: draft.durationMinutes,
    intensity: draft.intensity,
    averageHeartRate: draft.averageHeartRate,
    wearableCalories: draft.wearableCaloriesBurned,
  });

  const exercises = draft.exercises.map((exercise, index) => ({
    muscleGroup: exercise.muscleGroup,
    exerciseName: exercise.exerciseName,
    exerciseVariant: exercise.exerciseVariant,
    equipment: exercise.equipment,
    exerciseCatalogId: exercise.exerciseCatalogId,
    exerciseOrder: index + 1,
    notes: null,
    sets: exercise.sets.map((set, setIndex) => ({
      setNumber: set.setNumber || setIndex + 1,
      reps: set.reps,
      weightKg: set.weightKg,
      weightMode: set.weightMode,
      rir: set.rir,
      rpe: set.rpe,
      completed: set.completed,
      restSeconds: set.restSeconds,
      notes: null,
    })),
  }));

  const { data, error } = await supabase.rpc("create_workout_session", {
    p_workout_date: draft.workoutDate,
    p_duration_minutes: draft.durationMinutes,
    p_intensity: draft.intensity,
    p_training_phase: draft.trainingPhase,
    p_estimated_calories_burned:
      calorieEstimate.source === "estimated" ? calorieEstimate.calories : null,
    p_wearable_calories_burned:
      calorieEstimate.source === "wearable" ? calorieEstimate.calories : null,
    p_calories_source: calorieEstimate.source === "unavailable" ? null : calorieEstimate.source,
    p_average_heart_rate: draft.averageHeartRate,
    p_max_heart_rate: draft.maxHeartRate,
    p_total_volume: totalVolume,
    p_notes: draft.notes || null,
    p_exercises: exercises as unknown as Json,
  });

  if (error) throw error;
  if (!data) throw new Error("The workout could not be saved. Please try again.");
  return data as unknown as WorkoutSessionRecord;
}

export async function updateWorkoutSession(
  id: string,
  patch: Partial<
    Pick<
      SessionRow,
      | "workout_date"
      | "duration_minutes"
      | "intensity"
      | "training_phase"
      | "notes"
      | "average_heart_rate"
      | "max_heart_rate"
    >
  >,
): Promise<SessionRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("workout_sessions")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

export interface WorkoutRangeStats {
  sessions: SessionRow[];
  workouts: number;
  totalDurationMinutes: number;
  totalVolume: number;
  completedSets: number;
  totalSets: number;
  muscleGroups: string[];
  averageHeartRate: number | null;
  calories: { value: number | null; anyWearable: boolean; anyEstimated: boolean };
}

/** One roll-up for the workout dashboard over a date range. */
export async function fetchWorkoutStats(
  fromDate: string,
  toDate: string,
): Promise<WorkoutRangeStats> {
  const user = await requireUser();
  const sessions = await fetchWorkoutSessions(fromDate, toDate);

  const empty: WorkoutRangeStats = {
    sessions,
    workouts: sessions.length,
    totalDurationMinutes: 0,
    totalVolume: 0,
    completedSets: 0,
    totalSets: 0,
    muscleGroups: [],
    averageHeartRate: null,
    calories: { value: sessions.length ? 0 : null, anyWearable: false, anyEstimated: false },
  };
  if (sessions.length === 0) return empty;

  const sessionIds = sessions.map((session) => session.id);
  const { data: exerciseRows, error: exerciseError } = await supabase
    .from("workout_exercises")
    .select("id, session_id, muscle_group")
    .eq("user_id", user.id)
    .in("session_id", sessionIds);
  if (exerciseError) throw exerciseError;

  const exercises = exerciseRows ?? [];
  const exerciseIds = exercises.map((row) => row.id);

  let completedSets = 0;
  let totalSets = 0;
  if (exerciseIds.length > 0) {
    const { data: setRows, error: setError } = await supabase
      .from("workout_sets")
      .select("completed")
      .in("workout_exercise_id", exerciseIds);
    if (setError) throw setError;
    for (const set of setRows ?? []) {
      totalSets += 1;
      if (set.completed) completedSets += 1;
    }
  }

  let totalDuration = 0;
  let totalVolume = 0;
  let calorieTotal = 0;
  let anyWearable = false;
  let anyEstimated = false;
  const hrValues: number[] = [];

  for (const session of sessions) {
    totalDuration += session.duration_minutes ?? 0;
    totalVolume += Number(session.total_volume ?? 0);
    if (session.average_heart_rate != null) hrValues.push(session.average_heart_rate);

    if (session.calories_source === "wearable" && session.wearable_calories_burned != null) {
      calorieTotal += Number(session.wearable_calories_burned);
      anyWearable = true;
    } else if (
      session.calories_source === "estimated" &&
      session.estimated_calories_burned != null
    ) {
      calorieTotal += Number(session.estimated_calories_burned);
      anyEstimated = true;
    }
  }

  const muscleGroups = [...new Set(exercises.map((row) => row.muscle_group).filter(Boolean))].sort();

  return {
    sessions,
    workouts: sessions.length,
    totalDurationMinutes: totalDuration,
    totalVolume,
    completedSets,
    totalSets,
    muscleGroups,
    averageHeartRate: hrValues.length
      ? Math.round(hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length)
      : null,
    calories: { value: Math.round(calorieTotal), anyWearable, anyEstimated },
  };
}

/* --------------------------- training preferences ------------------------- */

function rowToPreferences(row: PreferencesRow): TrainingPreferences {
  return {
    trainingPhase: row.training_phase,
    experienceLevel: row.experience_level,
    progressionMode:
      row.progression_mode === "weight_first" || row.progression_mode === "reps_first"
        ? row.progression_mode
        : "double_progression",
    targetMinReps: row.target_min_reps,
    targetMaxReps: row.target_max_reps,
    targetSets: row.target_sets,
    minimumSessionsForSuggestion: row.minimum_sessions_for_suggestion,
    minimumWeeksForSuggestion: row.minimum_weeks_for_suggestion,
  };
}

export async function fetchTrainingPreferences(): Promise<TrainingPreferences> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("user_training_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return rowToPreferences(data);

  const { data: created, error: insertError } = await supabase
    .from("user_training_preferences")
    .insert({ user_id: user.id })
    .select("*")
    .single();
  if (insertError) throw insertError;
  return rowToPreferences(created);
}

export async function saveTrainingPreferences(
  prefs: Partial<TrainingPreferences> & { experienceLevel?: ExperienceLevel | null },
): Promise<TrainingPreferences> {
  const user = await requireUser();
  const patch: Database["public"]["Tables"]["user_training_preferences"]["Update"] = {};

  if (prefs.trainingPhase !== undefined) patch.training_phase = prefs.trainingPhase;
  if (prefs.experienceLevel !== undefined) patch.experience_level = prefs.experienceLevel;
  if (prefs.progressionMode !== undefined) patch.progression_mode = prefs.progressionMode;
  if (prefs.targetMinReps !== undefined) patch.target_min_reps = prefs.targetMinReps;
  if (prefs.targetMaxReps !== undefined) patch.target_max_reps = prefs.targetMaxReps;
  if (prefs.targetSets !== undefined) patch.target_sets = prefs.targetSets;
  if (prefs.minimumSessionsForSuggestion !== undefined) {
    patch.minimum_sessions_for_suggestion = prefs.minimumSessionsForSuggestion;
  }
  if (prefs.minimumWeeksForSuggestion !== undefined) {
    patch.minimum_weeks_for_suggestion = prefs.minimumWeeksForSuggestion;
  }

  const { data, error } = await supabase
    .from("user_training_preferences")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToPreferences(data);
}

/* ----------------------------- exercise history -------------------------- */

function dominantWeight(
  sets: Array<{ weightKg: number | null; completed: boolean }>,
): number | null {
  const counts = new Map<number, number>();
  for (const set of sets) {
    if (!set.completed || set.weightKg === null || !Number.isFinite(set.weightKg)) continue;
    counts.set(set.weightKg, (counts.get(set.weightKg) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [weight, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && weight > best)) {
      best = weight;
      bestCount = count;
    }
  }
  return best;
}

export async function fetchExerciseHistory(exerciseName: string): Promise<ProgressionHistoryItem[]> {
  const user = await requireUser();
  const name = exerciseName.trim();
  if (!name) return [];

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from("workout_exercises")
    .select("id, session_id, exercise_name")
    .eq("user_id", user.id)
    .ilike("exercise_name", name);
  if (exerciseError) throw exerciseError;

  const exercises = exerciseRows ?? [];
  if (exercises.length === 0) return [];

  const sessionIds = [...new Set(exercises.map((row) => row.session_id))];
  const exerciseIds = exercises.map((row) => row.id);

  const [sessionResult, setResult] = await Promise.all([
    supabase.from("workout_sessions").select("id, workout_date").in("id", sessionIds),
    supabase
      .from("workout_sets")
      .select("workout_exercise_id, reps, weight_kg, completed, rir")
      .in("workout_exercise_id", exerciseIds),
  ]);
  if (sessionResult.error) throw sessionResult.error;
  if (setResult.error) throw setResult.error;

  const dateBySession = new Map(
    (sessionResult.data ?? []).map((row) => [row.id, row.workout_date] as const),
  );
  const sessionByExercise = new Map(
    exercises.map((row) => [row.id, row.session_id] as const),
  );

  type MiniSet = { reps: number; weightKg: number | null; completed: boolean; rir: number | null };
  const setsBySession = new Map<string, MiniSet[]>();
  for (const set of setResult.data ?? []) {
    const sessionId = sessionByExercise.get(set.workout_exercise_id);
    if (!sessionId) continue;
    const list = setsBySession.get(sessionId) ?? [];
    list.push({
      reps: set.reps,
      weightKg: set.weight_kg,
      completed: set.completed,
      rir: set.rir,
    });
    setsBySession.set(sessionId, list);
  }

  const items: ProgressionHistoryItem[] = [];
  for (const [sessionId, sets] of setsBySession) {
    const sessionDate = dateBySession.get(sessionId);
    if (!sessionDate) continue;

    const completedSets = sets.filter((set) => set.completed).length;
    const totalSets = sets.length;
    const maxReps = sets.reduce((max, set) => (set.completed && set.reps > max ? set.reps : max), 0);
    const totalVolume = sets.reduce(
      (sum, set) =>
        sum + (set.completed && set.weightKg && Number.isFinite(set.weightKg) ? set.reps * set.weightKg : 0),
      0,
    );
    const rirValues = sets
      .map((set) => set.rir)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const averageRir =
      rirValues.length > 0 ? rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length : null;

    items.push({
      sessionDate,
      weightKg: dominantWeight(sets),
      completedSets,
      totalSets,
      maxReps,
      totalVolume,
      averageRir,
    });
  }

  return items.sort(
    (a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime(),
  );
}

/* -------------------------------- notifications -------------------------- */

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const user = await requireUser();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) throw error;
}

export async function dismissNotification(id: string): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ is_dismissed: true, is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}
