import { describe, expect, it } from "vitest";

import type { ProgressionHistoryItem } from "../../src/lib/workouts/calculations";
import {
  formatPreviousPerformance,
  pickPreviousSession,
  weightToReuse,
} from "../../src/lib/workouts/previousPerformance";

function session(over: Partial<ProgressionHistoryItem> = {}): ProgressionHistoryItem {
  return {
    sessionDate: "2026-09-10",
    weightKg: 60,
    completedSets: 3,
    totalSets: 3,
    maxReps: 10,
    totalVolume: 1800,
    averageRir: null,
    ...over,
  };
}

describe("pickPreviousSession", () => {
  it("returns null for no history", () => {
    expect(pickPreviousSession([], "2026-09-20")).toBeNull();
    expect(pickPreviousSession([])).toBeNull();
  });

  it("picks the most recent session strictly before the workout date", () => {
    const history = [
      session({ sessionDate: "2026-09-01", weightKg: 50 }),
      session({ sessionDate: "2026-09-10", weightKg: 60 }),
      session({ sessionDate: "2026-09-05", weightKg: 55 }),
    ];
    expect(pickPreviousSession(history, "2026-09-20")).toMatchObject({
      date: "2026-09-10",
      weightKg: 60,
    });
  });

  it("never reports the workout's own date (or a later one) as its previous performance", () => {
    const history = [
      session({ sessionDate: "2026-09-10", weightKg: 60 }),
      session({ sessionDate: "2026-09-20", weightKg: 70 }),
      session({ sessionDate: "2026-09-25", weightKg: 80 }),
    ];
    expect(pickPreviousSession(history, "2026-09-20")?.date).toBe("2026-09-10");
    expect(pickPreviousSession(history, "2026-09-10")).toBeNull();
  });

  it("ignores sessions where nothing was completed", () => {
    const history = [
      session({ sessionDate: "2026-09-10", completedSets: 0, totalSets: 3 }),
      session({ sessionDate: "2026-09-05", weightKg: 55 }),
    ];
    expect(pickPreviousSession(history, "2026-09-20")?.date).toBe("2026-09-05");
  });

  it("without a date, returns the latest overall", () => {
    const history = [
      session({ sessionDate: "2026-09-01" }),
      session({ sessionDate: "2026-09-12" }),
    ];
    expect(pickPreviousSession(history)?.date).toBe("2026-09-12");
  });

  it("does not depend on the order of the history", () => {
    const a = session({ sessionDate: "2026-09-01" });
    const b = session({ sessionDate: "2026-09-12" });
    expect(pickPreviousSession([a, b], "2026-09-30")).toEqual(
      pickPreviousSession([b, a], "2026-09-30"),
    );
  });
});

describe("formatPreviousPerformance", () => {
  const prev = { date: "2026-09-10", weightKg: 60, completedSets: 3, bestReps: 10 };

  it("states weight, sets and best reps", () => {
    expect(formatPreviousPerformance(prev, false)).toBe("60 kg · 3 sets · up to 10 reps");
  });

  it("singular set and decimal weights", () => {
    expect(formatPreviousPerformance({ ...prev, weightKg: 42.5, completedSets: 1 }, false)).toBe(
      "42.5 kg · 1 set · up to 10 reps",
    );
  });

  it("bodyweight exercises: added weight is labelled, none reads as bodyweight", () => {
    expect(formatPreviousPerformance({ ...prev, weightKg: 10 }, true)).toBe(
      "10 kg added · 3 sets · up to 10 reps",
    );
    expect(formatPreviousPerformance({ ...prev, weightKg: null }, true)).toBe(
      "bodyweight · 3 sets · up to 10 reps",
    );
  });

  it("states nothing it does not know (no weight, no reps)", () => {
    expect(formatPreviousPerformance({ ...prev, weightKg: null, bestReps: 0 }, false)).toBe(
      "3 sets",
    );
  });
});

describe("weightToReuse", () => {
  it("offers only a real, positive weight", () => {
    expect(weightToReuse({ date: "d", weightKg: 60, completedSets: 1, bestReps: 8 })).toBe(60);
    expect(weightToReuse({ date: "d", weightKg: 0, completedSets: 1, bestReps: 8 })).toBeNull();
    expect(weightToReuse({ date: "d", weightKg: null, completedSets: 1, bestReps: 8 })).toBeNull();
  });
});
