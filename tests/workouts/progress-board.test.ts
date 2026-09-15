import { describe, expect, it } from "vitest";

import {
  compareExercisePeriods,
  resolveProgressBoardWindow,
  summarizeExercisePeriod,
  type ExercisePeriodStats,
} from "../../src/lib/workouts/calculations";

describe("summarizeExercisePeriod", () => {
  it("returns all-empty stats for no sets", () => {
    const stats = summarizeExercisePeriod([]);
    expect(stats).toEqual({
      completedSets: 0,
      totalSets: 0,
      totalVolume: 0,
      topWeightKg: null,
      repsAtTopWeight: null,
      averageReps: null,
    });
  });

  it("ignores incomplete sets entirely", () => {
    const stats = summarizeExercisePeriod([
      { reps: 10, weightKg: 60, weightMode: "external", completed: false },
    ]);
    expect(stats.completedSets).toBe(0);
    expect(stats.totalSets).toBe(1);
    expect(stats.topWeightKg).toBeNull();
  });

  it("takes the max weight as the working weight and averages reps at it", () => {
    const stats = summarizeExercisePeriod([
      { reps: 10, weightKg: 40, weightMode: "external", completed: true },
      { reps: 8, weightKg: 42.5, weightMode: "external", completed: true },
      { reps: 6, weightKg: 42.5, weightMode: "external", completed: true },
    ]);
    expect(stats.topWeightKg).toBe(42.5);
    expect(stats.repsAtTopWeight).toBe(7); // (8 + 6) / 2
    expect(stats.completedSets).toBe(3);
    expect(stats.totalVolume).toBe(10 * 40 + 8 * 42.5 + 6 * 42.5);
  });

  it("treats pure bodyweight sets as having no working weight, only reps", () => {
    const stats = summarizeExercisePeriod([
      { reps: 12, weightKg: null, weightMode: "bodyweight", completed: true },
      { reps: 10, weightKg: null, weightMode: "bodyweight", completed: true },
    ]);
    expect(stats.topWeightKg).toBeNull();
    expect(stats.averageReps).toBe(11);
  });
});

const weighted = (overrides: Partial<ExercisePeriodStats> = {}): ExercisePeriodStats => ({
  completedSets: 3,
  totalSets: 3,
  totalVolume: 900,
  topWeightKg: 40,
  repsAtTopWeight: 10,
  averageReps: 10,
  ...overrides,
});

describe("compareExercisePeriods", () => {
  it("reports insufficient_data when the current period has nothing logged", () => {
    const result = compareExercisePeriods(
      weighted({ completedSets: 0, topWeightKg: null }),
      weighted(),
    );
    expect(result.status).toBe("insufficient_data");
  });

  it("reports insufficient_data when there is nothing comparable in the previous period", () => {
    const result = compareExercisePeriods(
      weighted(),
      weighted({ completedSets: 0, topWeightKg: null }),
    );
    expect(result.status).toBe("insufficient_data");
  });

  it("progressed: heavier working weight than last time", () => {
    const result = compareExercisePeriods(
      weighted({ topWeightKg: 42.5 }),
      weighted({ topWeightKg: 40 }),
    );
    expect(result.status).toBe("progressed");
    expect(result.changeWeightKg).toBe(2.5);
  });

  it("decreased: lighter working weight than last time", () => {
    const result = compareExercisePeriods(
      weighted({ topWeightKg: 35 }),
      weighted({ topWeightKg: 40 }),
    );
    expect(result.status).toBe("decreased");
  });

  it("progressed: same weight, more reps at that weight", () => {
    const result = compareExercisePeriods(
      weighted({ topWeightKg: 40, repsAtTopWeight: 12 }),
      weighted({ topWeightKg: 40, repsAtTopWeight: 10 }),
    );
    expect(result.status).toBe("progressed");
    expect(result.changeReps).toBe(2);
  });

  it("decreased: same weight, fewer reps at that weight", () => {
    const result = compareExercisePeriods(
      weighted({ topWeightKg: 40, repsAtTopWeight: 8 }),
      weighted({ topWeightKg: 40, repsAtTopWeight: 10 }),
    );
    expect(result.status).toBe("decreased");
  });

  it("progressed: same weight and reps, but more completed sets", () => {
    const result = compareExercisePeriods(
      weighted({ topWeightKg: 40, repsAtTopWeight: 10, completedSets: 4 }),
      weighted({ topWeightKg: 40, repsAtTopWeight: 10, completedSets: 3 }),
    );
    expect(result.status).toBe("progressed");
    expect(result.changeSets).toBe(1);
  });

  it("maintained: same weight, reps and sets", () => {
    const result = compareExercisePeriods(weighted(), weighted());
    expect(result.status).toBe("maintained");
  });

  it("does NOT call it progress from total volume alone when weight/reps/sets are unchanged", () => {
    // Same working weight, same reps at that weight, same completed-set count —
    // but a different totalVolume (e.g. a differently-loaded warm-up set changed
    // it). Volume must never be the deciding signal.
    const result = compareExercisePeriods(
      weighted({ totalVolume: 1500 }),
      weighted({ totalVolume: 900 }),
    );
    expect(result.status).toBe("maintained");
  });

  it("bodyweight: progressed via more reps when no working weight is tracked", () => {
    const result = compareExercisePeriods(
      weighted({ topWeightKg: null, repsAtTopWeight: null, averageReps: 14 }),
      weighted({ topWeightKg: null, repsAtTopWeight: null, averageReps: 12 }),
    );
    expect(result.status).toBe("progressed");
  });

  it("bodyweight: progressed via more sets when reps are tied", () => {
    const result = compareExercisePeriods(
      weighted({ topWeightKg: null, repsAtTopWeight: null, averageReps: 12, completedSets: 4 }),
      weighted({ topWeightKg: null, repsAtTopWeight: null, averageReps: 12, completedSets: 3 }),
    );
    expect(result.status).toBe("progressed");
  });

  it("never lets one exercise's result depend on another — pure function of its own two stats", () => {
    // Calling it twice with the same two exercises' stats, interleaved, must
    // give each exercise the same answer regardless of call order — proving
    // there is no shared/global state a "biceps progressed" result could leak
    // through to suppress a different exercise's comparison.
    const bicepsCurrent = weighted({ topWeightKg: 15 });
    const bicepsPrevious = weighted({ topWeightKg: 12.5 });
    const legsCurrent = weighted({ topWeightKg: 60 });
    const legsPrevious = weighted({ topWeightKg: 50 });

    const bicepsFirst = compareExercisePeriods(bicepsCurrent, bicepsPrevious);
    const legsAfterBiceps = compareExercisePeriods(legsCurrent, legsPrevious);
    const legsFirst = compareExercisePeriods(legsCurrent, legsPrevious);

    expect(bicepsFirst.status).toBe("progressed");
    expect(legsAfterBiceps.status).toBe("progressed");
    expect(legsFirst).toEqual(legsAfterBiceps);
  });
});

function dayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00`).getDay();
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`).getTime();
  const to = new Date(`${toKey}T00:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

describe("resolveProgressBoardWindow", () => {
  it("this_week: current starts on Monday and previous is the full week right before it", () => {
    const now = new Date(2026, 8, 16, 14, 30);
    const window = resolveProgressBoardWindow("this_week", now);
    expect(dayOfWeek(window.currentFrom)).toBe(1);
    expect(daysBetween(window.previousFrom, window.previousTo)).toBe(6);
    expect(daysBetween(window.previousTo, window.currentFrom)).toBe(1);
  });

  it("last_week: current is a full Monday-Sunday week, compared to the week before it", () => {
    const now = new Date(2026, 8, 16, 14, 30);
    const window = resolveProgressBoardWindow("last_week", now);
    expect(dayOfWeek(window.currentFrom)).toBe(1);
    expect(dayOfWeek(window.currentTo)).toBe(0);
    expect(daysBetween(window.currentFrom, window.currentTo)).toBe(6);
    expect(daysBetween(window.previousTo, window.currentFrom)).toBe(1);
    expect(daysBetween(window.previousFrom, window.previousTo)).toBe(6);
  });

  it("this_month: current is month-to-date, previous is the full prior calendar month", () => {
    const now = new Date(2026, 8, 16);
    const window = resolveProgressBoardWindow("this_month", now);
    expect(window.currentFrom).toBe("2026-09-01");
    expect(window.currentTo).toBe("2026-09-16");
    expect(window.previousFrom).toBe("2026-08-01");
    expect(window.previousTo).toBe("2026-08-31");
  });
});
