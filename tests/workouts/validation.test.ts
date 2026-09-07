import { describe, expect, it } from "vitest";

import type {
  WorkoutExerciseDraft,
  WorkoutSessionDraft,
  WorkoutSetDraft,
} from "../../src/lib/workouts/types";
import {
  isValidSet,
  validateSet,
  validateWorkoutDraft,
} from "../../src/lib/workouts/validation";

const set = (over: Partial<WorkoutSetDraft>): WorkoutSetDraft => ({
  setNumber: 1,
  reps: 10,
  weightKg: 40,
  weightMode: "external",
  rir: 2,
  rpe: 8,
  completed: true,
  restSeconds: 90,
  ...over,
});

const exercise = (over: Partial<WorkoutExerciseDraft>): WorkoutExerciseDraft => ({
  muscleGroup: "Chest",
  exerciseName: "Barbell Bench Press",
  exerciseVariant: null,
  equipment: "Barbell",
  exerciseCatalogId: null,
  isBodyweight: false,
  sets: [set({})],
  ...over,
});

const draft = (over: Partial<WorkoutSessionDraft>): WorkoutSessionDraft => ({
  workoutDate: "2026-09-08",
  durationMinutes: 60,
  intensity: "moderate",
  trainingPhase: "hypertrophy",
  notes: "",
  wearableCaloriesBurned: null,
  averageHeartRate: null,
  maxHeartRate: null,
  exercises: [exercise({})],
  ...over,
});

describe("validateSet", () => {
  it("accepts a valid external-load set", () => {
    expect(validateSet(set({}))).toEqual([]);
  });

  it("rejects non-positive or non-integer reps", () => {
    expect(validateSet(set({ reps: 0 })).length).toBeGreaterThan(0);
    expect(validateSet(set({ reps: 8.5 })).length).toBeGreaterThan(0);
    expect(validateSet(set({ reps: 2000 })).length).toBeGreaterThan(0);
  });

  it("requires a non-negative weight for external / total / custom modes", () => {
    expect(validateSet(set({ weightMode: "external", weightKg: null })).length).toBeGreaterThan(0);
    expect(validateSet(set({ weightMode: "custom", weightKg: -5 })).length).toBeGreaterThan(0);
    expect(validateSet(set({ weightMode: "custom", weightKg: 42.5 }))).toEqual([]);
  });

  it("allows a bodyweight set with no weight, and optional added load", () => {
    expect(isValidSet(set({ weightMode: "bodyweight", weightKg: null }))).toBe(true);
    expect(isValidSet(set({ weightMode: "bodyweight", weightKg: 10 }))).toBe(true);
    expect(isValidSet(set({ weightMode: "bodyweight", weightKg: -1 }))).toBe(false);
  });

  it("validates RIR (0-10) and RPE (1-10)", () => {
    expect(validateSet(set({ rir: 11 })).length).toBeGreaterThan(0);
    expect(validateSet(set({ rir: -1 })).length).toBeGreaterThan(0);
    expect(validateSet(set({ rpe: 0 })).length).toBeGreaterThan(0);
    expect(validateSet(set({ rpe: 11 })).length).toBeGreaterThan(0);
    expect(validateSet(set({ rir: 0, rpe: 10 }))).toEqual([]);
  });

  it("validates rest seconds (0-3600)", () => {
    expect(validateSet(set({ restSeconds: 5000 })).length).toBeGreaterThan(0);
    expect(validateSet(set({ restSeconds: 0 }))).toEqual([]);
  });
});

describe("validateWorkoutDraft", () => {
  it("accepts a well-formed workout", () => {
    expect(validateWorkoutDraft(draft({})).ok).toBe(true);
  });

  it("requires at least one exercise", () => {
    expect(validateWorkoutDraft(draft({ exercises: [] })).ok).toBe(false);
  });

  it("requires every exercise to have at least one valid set", () => {
    const result = validateWorkoutDraft(
      draft({ exercises: [exercise({ sets: [set({ reps: 0 })] })] }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an out-of-range duration", () => {
    expect(validateWorkoutDraft(draft({ durationMinutes: 5000 })).ok).toBe(false);
    expect(validateWorkoutDraft(draft({ durationMinutes: -1 })).ok).toBe(false);
  });

  it("rejects negative wearable calories", () => {
    expect(validateWorkoutDraft(draft({ wearableCaloriesBurned: -10 })).ok).toBe(false);
  });
});
