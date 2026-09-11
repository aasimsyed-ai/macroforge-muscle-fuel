import { describe, expect, it } from "vitest";

import { buildMilestoneDrafts, type MilestoneContext } from "../src/lib/milestones";

const baseCtx: MilestoneContext = {
  totalMeals: 0,
  totalWorkouts: 0,
  loggingStreak: 0,
  proteinHitDays: 0,
};

describe("buildMilestoneDrafts", () => {
  it("returns nothing when no threshold is met", () => {
    expect(buildMilestoneDrafts(baseCtx)).toHaveLength(0);
  });

  it("fires first-7-days at exactly 7, not before", () => {
    expect(buildMilestoneDrafts({ ...baseCtx, loggingStreak: 6 })).toHaveLength(0);
    const drafts = buildMilestoneDrafts({ ...baseCtx, loggingStreak: 7 });
    expect(drafts.map((d) => d.dedupeKey)).toContain("milestone:first-7-days");
  });

  it("fires multiple milestones at once when several thresholds are met", () => {
    const drafts = buildMilestoneDrafts({
      totalMeals: 100,
      totalWorkouts: 10,
      loggingStreak: 30,
      proteinHitDays: 20,
    });
    const keys = drafts.map((d) => d.dedupeKey).sort();
    expect(keys).toEqual(
      [
        "milestone:100-meals",
        "milestone:10-workouts",
        "milestone:30-day-consistency",
        "milestone:first-7-days",
        "milestone:protein-20",
      ].sort(),
    );
  });

  it("every draft uses the shared motivation category so it goes through the same throttle as other notifications", () => {
    const drafts = buildMilestoneDrafts({ ...baseCtx, loggingStreak: 7 });
    expect(drafts.every((d) => d.category === "motivation")).toBe(true);
  });
});
