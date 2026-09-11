import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "./api";
import type { TrainingPreferences, WorkoutSessionDraft } from "./types";

const WORKOUT_KEY = ["workout"] as const;
const NOTIFICATION_KEY = ["notifications"] as const;

export function useExerciseCatalog() {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "catalog"],
    queryFn: api.fetchExerciseCatalog,
    staleTime: 1000 * 60 * 60,
  });
}

export function useWorkoutStats(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "stats", fromDate, toDate],
    queryFn: () => api.fetchWorkoutStats(fromDate, toDate),
  });
}

export function useWorkoutSession(id: string | null) {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "session", id ?? ""],
    enabled: !!id,
    queryFn: () => api.fetchWorkoutSessionById(id as string),
  });
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { draft: WorkoutSessionDraft; bodyWeightKg: number | null }) =>
      api.createWorkoutSession(vars.draft, vars.bodyWeightKg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WORKOUT_KEY });
      qc.invalidateQueries({ queryKey: NOTIFICATION_KEY });
    },
  });
}

export function useReplaceWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { oldId: string; draft: WorkoutSessionDraft; bodyWeightKg: number | null }) =>
      api.replaceWorkoutSession(vars.oldId, vars.draft, vars.bodyWeightKg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WORKOUT_KEY });
      qc.invalidateQueries({ queryKey: NOTIFICATION_KEY });
    },
  });
}

export function useRecentWorkoutSessions() {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "recent-sessions"],
    queryFn: () => api.fetchRecentWorkoutSessions(10),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteWorkoutSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKOUT_KEY }),
  });
}

export function useTrainingPreferences() {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "preferences"],
    queryFn: api.fetchTrainingPreferences,
  });
}

export function useSaveTrainingPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<TrainingPreferences>) => api.saveTrainingPreferences(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...WORKOUT_KEY, "preferences"] }),
  });
}

export function useRecentExerciseNames() {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "recent-exercises"],
    queryFn: () => api.fetchRecentExerciseNames(12),
  });
}

export function useTrainingHistorySummary() {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "history-summary"],
    queryFn: api.fetchTrainingHistorySummary,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "notification-preferences"],
    queryFn: api.fetchNotificationPreferences,
  });
}

export function useSaveNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof api.saveNotificationPreferences>[0]) =>
      api.saveNotificationPreferences(patch),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [...WORKOUT_KEY, "notification-preferences"] }),
  });
}

export function useExerciseHistory(exerciseName: string | null) {
  return useQuery({
    queryKey: [...WORKOUT_KEY, "history", (exerciseName ?? "").trim().toLowerCase()],
    enabled: !!exerciseName && exerciseName.trim().length > 0,
    queryFn: () => api.fetchExerciseHistory(exerciseName as string),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATION_KEY,
    queryFn: api.fetchNotifications,
    refetchInterval: 1000 * 60,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATION_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATION_KEY }),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.dismissNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATION_KEY }),
  });
}
