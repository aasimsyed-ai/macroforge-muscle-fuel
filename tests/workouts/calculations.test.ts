import { describe, expect, it } from "vitest";

import {
  analyzeExerciseProgression,
  calculateExperienceLevel,
  calculateSessionVolume,
  calculateSetVolume,
  calculateWorkoutCalories,
  getNextAvailableWeight,
  weeksBetween,
  type ProgressionHistoryItem,
} from "../../src/lib/workouts/calculations";
import { DEFAULT_TRAINING_PREFERENCES } from "../../src/lib/workouts/constants";

const prefs = DEFAULT_TRAINING_PREFERENCES;

describe("calculateSetVolume", () => {
  it("multiplies reps by weight for a completed external-load set", () => {
    expect(
      calculateSetVolume({ reps: 10, weightKg: 60, weightMode: "external", completed: true }),
    ).toBe(600);
  });

  it("returns 0 for an incomplete set", () => {
    expect(
      calculateSetVolume({ reps: 10, weightKg: 60, weightMode: "external", completed: false }),
    ).toBe(0);
  });

  it("returns 0 for a bodyweight set (no external load counted)", () => {
    expect(
      calculateSetVolume({ reps: 12, weightKg: null, weightMode: "bodyweight", completed: true }),
    ).toBe(0);
  });

  it("returns 0 when weight is null or non-finite", () => {
    expect(
      calculateSetVolume({ reps: 8, weightKg: null, weightMode: "external", completed: true }),
    ).toBe(0);
    expect(
      calculateSetVolume({ reps: 8, weightKg: Number.NaN, weightMode: "custom", completed: true }),
    ).toBe(0);
  });

  it("counts custom-weight sets like external load", () => {
    expect(
      calculateSetVolume({ reps: 6, weightKg: 42.5, weightMode: "custom", completed: true }),
    ).toBe(255);
  });
});

describe("calculateSessionVolume", () => {
  it("sums completed external-load volume across exercises and sets", () => {
    const total = calculateSessionVolume([
      {
        sets: [
          { reps: 10, weightKg: 50, weightMode: "external", completed: true },
          { reps: 8, weightKg: 55, weightMode: "external", completed: true },
        ],
      },
      {
        sets: [
          { reps: 12, weightKg: null, weightMode: "bodyweight", completed: true },
          { reps: 12, weightKg: 20, weightMode: "custom", completed: false },
        ],
      },
    ]);
    // 500 + 440 + 0 + 0
    expect(total).toBe(940);
  });
});

describe("calculateWorkoutCalories", () => {
  it("prefers valid wearable calories over an estimate", () => {
    const result = calculateWorkoutCalories({
      bodyWeightKg: 70,
      durationMinutes: 60,
      intensity: "vigorous",
      averageHeartRate: 150,
      wearableCalories: 480,
    });
    expect(result.source).toBe("wearable");
    expect(result.calories).toBe(480);
  });

  it("estimates from body weight, duration and intensity when there is no wearable value", () => {
    const result = calculateWorkoutCalories({
      bodyWeightKg: 70,
      durationMinutes: 60,
      intensity: "moderate",
      averageHeartRate: null,
      wearableCalories: null,
    });
    expect(result.source).toBe("estimated");
    // 5 MET * 3.5 * 70 / 200 * 60 = 367.5 -> 368
    expect(result.calories).toBe(368);
  });

  it("never adds wearable and estimated calories together", () => {
    const withWearable = calculateWorkoutCalories({
      bodyWeightKg: 70,
      durationMinutes: 60,
      intensity: "moderate",
      averageHeartRate: null,
      wearableCalories: 400,
    });
    const estimatedOnly = calculateWorkoutCalories({
      bodyWeightKg: 70,
      durationMinutes: 60,
      intensity: "moderate",
      averageHeartRate: null,
      wearableCalories: null,
    });
    expect(withWearable.calories).toBe(400);
    expect(withWearable.calories).not.toBe((estimatedOnly.calories ?? 0) + 400);
  });

  it("returns unavailable when required inputs are missing or invalid", () => {
    expect(
      calculateWorkoutCalories({
        bodyWeightKg: null,
        durationMinutes: 60,
        intensity: "moderate",
        averageHeartRate: null,
        wearableCalories: null,
      }).source,
    ).toBe("unavailable");
    expect(
      calculateWorkoutCalories({
        bodyWeightKg: 70,
        durationMinutes: 0,
        intensity: "moderate",
        averageHeartRate: null,
        wearableCalories: null,
      }).calories,
    ).toBeNull();
    expect(
      calculateWorkoutCalories({
        bodyWeightKg: 70,
        durationMinutes: 60,
        intensity: "moderate",
        averageHeartRate: null,
        wearableCalories: Number.NaN,
      }).source,
    ).toBe("estimated");
  });
});

describe("getNextAvailableWeight", () => {
  it("returns the next plate up from the standard ladder", () => {
    expect(getNextAvailableWeight(20)).toBe(22.5);
    expect(getNextAvailableWeight(21)).toBe(22.5);
  });

  it("returns null when already at or above the top", () => {
    expect(getNextAvailableWeight(50)).toBeNull();
    expect(getNextAvailableWeight(999)).toBeNull();
  });
});

describe("weeksBetween", () => {
  it("computes fractional weeks between two ISO dates", () => {
    expect(weeksBetween("2026-01-01", "2026-01-15")).toBeCloseTo(2, 5);
  });
  it("returns 0 for invalid or reversed dates", () => {
    expect(weeksBetween("not-a-date", "2026-01-15")).toBe(0);
    expect(weeksBetween("2026-02-01", "2026-01-01")).toBe(0);
  });
});

describe("calculateExperienceLevel", () => {
  it("returns null with a reason when history is too thin", () => {
    expect(
      calculateExperienceLevel({
        consistentWeeks: 2,
        completedSessions: 3,
        hasProgressionEvidence: false,
      }).level,
    ).toBeNull();
  });

  it("classifies beginner / intermediate / advanced from history", () => {
    expect(
      calculateExperienceLevel({
        consistentWeeks: 6,
        completedSessions: 8,
        hasProgressionEvidence: false,
      }).level,
    ).toBe("beginner");
    expect(
      calculateExperienceLevel({
        consistentWeeks: 16,
        completedSessions: 30,
        hasProgressionEvidence: true,
      }).level,
    ).toBe("intermediate");
    expect(
      calculateExperienceLevel({
        consistentWeeks: 60,
        completedSessions: 120,
        hasProgressionEvidence: true,
      }).level,
    ).toBe("advanced");
    expect(
      calculateExperienceLevel({
        consistentWeeks: 60,
        completedSessions: 120,
        hasProgressionEvidence: false,
      }).level,
    ).toBe("intermediate");
  });
});

describe("analyzeExerciseProgression", () => {
  const base = (over: Partial<ProgressionHistoryItem>): ProgressionHistoryItem => ({
    sessionDate: "2026-01-01",
    weightKg: 60,
    completedSets: 3,
    totalSets: 3,
    maxReps: 10,
    totalVolume: 1800,
    averageRir: 2,
    ...over,
  });

  it("reports insufficient_data with one or two workouts", () => {
    const result = analyzeExerciseProgression([base({}), base({ sessionDate: "2026-01-08" })], prefs);
    expect(result.result).toBe("insufficient_data");
  });

  it("reports insufficient_data when sessions do not span enough weeks", () => {
    const result = analyzeExerciseProgression(
      [
        base({ sessionDate: "2026-01-01" }),
        base({ sessionDate: "2026-01-03" }),
        base({ sessionDate: "2026-01-05" }),
        base({ sessionDate: "2026-01-07" }),
      ],
      prefs,
    );
    expect(result.result).toBe("insufficient_data");
  });

  it("recommends progression after several weeks at the top of the rep range", () => {
    const result = analyzeExerciseProgression(
      [
        base({ sessionDate: "2026-01-01", weightKg: 15, maxReps: 10 }),
        base({ sessionDate: "2026-01-20", weightKg: 20, maxReps: 12, completedSets: 3 }),
        base({ sessionDate: "2026-02-01", weightKg: 20, maxReps: 12, completedSets: 3 }),
        base({ sessionDate: "2026-02-12", weightKg: 20, maxReps: 12, completedSets: 3 }),
      ],
      prefs,
    );
    expect(result.result).toBe("ready_to_progress");
    // next plate above 20 kg on the standard ladder
    expect(result.suggestedWeightKg).toBe(22.5);
  });

  it("suggests deload/recover when completion drops or effort maxes out", () => {
    const result = analyzeExerciseProgression(
      [
        base({ sessionDate: "2026-01-01", weightKg: 60 }),
        base({ sessionDate: "2026-01-20", weightKg: 60, completedSets: 1, totalSets: 3, averageRir: 0 }),
        base({ sessionDate: "2026-02-01", weightKg: 60, completedSets: 1, totalSets: 3, averageRir: 0 }),
        base({ sessionDate: "2026-02-12", weightKg: 60, completedSets: 1, totalSets: 3, averageRir: 0 }),
      ],
      prefs,
    );
    expect(result.result).toBe("deload_or_recover");
  });

  it("says maintain when mid-range across weeks", () => {
    const result = analyzeExerciseProgression(
      [
        base({ sessionDate: "2026-01-01", weightKg: 60, maxReps: 9 }),
        base({ sessionDate: "2026-01-20", weightKg: 60, maxReps: 9 }),
        base({ sessionDate: "2026-02-01", weightKg: 60, maxReps: 10 }),
        base({ sessionDate: "2026-02-12", weightKg: 60, maxReps: 10 }),
      ],
      prefs,
    );
    expect(result.result).toBe("maintain");
  });
});
