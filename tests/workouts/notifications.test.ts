import { describe, expect, it } from "vitest";

import type { NotificationPreferences } from "../../src/lib/workouts/api";
import {
  buildWorkoutNotifications,
  exerciseSlug,
  filterNotificationDrafts,
  isWithinQuietHours,
  isoWeekKey,
  type ExerciseProgressionResult,
  type NotificationContext,
} from "../../src/lib/workouts/notifications";

const prefs: NotificationPreferences = {
  enableProgression: true,
  enableMotivation: true,
  enableHealth: true,
  quietHoursStart: null,
  quietHoursEnd: null,
};

const progressionItem = (over: Partial<ExerciseProgressionResult>): ExerciseProgressionResult => ({
  exerciseName: "Barbell Bench Press",
  result: "ready_to_progress",
  confidence: "high",
  suggestedWeightKg: 62.5,
  explanation: "Top of range reached.",
  ...over,
});

const context = (over: Partial<NotificationContext>): NotificationContext => ({
  now: new Date("2026-09-08T10:00:00"),
  prefs,
  workoutsThisWeek: 0,
  returnedAfterBreak: false,
  progression: [],
  existing: [],
  ...over,
});

describe("exerciseSlug / isoWeekKey", () => {
  it("slugs exercise names deterministically", () => {
    expect(exerciseSlug("Barbell Bench Press")).toBe("barbell-bench-press");
    expect(exerciseSlug("  One-Arm Dumbbell Row  ")).toBe("one-arm-dumbbell-row");
  });

  it("produces a stable ISO week key", () => {
    expect(isoWeekKey(new Date("2026-09-08T10:00:00"))).toBe(isoWeekKey(new Date("2026-09-09T23:00:00")));
  });
});

describe("buildWorkoutNotifications", () => {
  it("creates a progression notification with a stable dedupe key", () => {
    const drafts = buildWorkoutNotifications(
      context({ progression: [progressionItem({})] }),
    );
    const progression = drafts.find((draft) => draft.category === "progression");
    expect(progression?.dedupeKey).toBe("progression:barbell-bench-press");
  });

  it("adds a motivation notification once three workouts are logged in a week", () => {
    const drafts = buildWorkoutNotifications(context({ workoutsThisWeek: 3 }));
    expect(drafts.some((draft) => draft.category === "motivation")).toBe(true);
  });

  it("does not create a progression notification from a single workout (insufficient_data is filtered upstream)", () => {
    const drafts = buildWorkoutNotifications(
      context({ progression: [progressionItem({ result: "maintain" })] }),
    );
    expect(drafts.some((draft) => draft.category === "progression")).toBe(false);
  });
});

describe("filterNotificationDrafts — spam rules", () => {
  it("drops a category that already has a notification today", () => {
    const drafts = buildWorkoutNotifications(context({ progression: [progressionItem({})] }));
    const filtered = filterNotificationDrafts(
      drafts,
      context({
        progression: [progressionItem({})],
        // Local (no "Z") and same day as `now` above, so the "already notified
        // today" check is unambiguous regardless of the test runner's timezone.
        existing: [{ category: "progression", created_at: "2026-09-08T09:00:00" }],
      }),
    );
    expect(filtered).toHaveLength(0);
  });

  it("never emits two drafts of the same category in one run", () => {
    const drafts = buildWorkoutNotifications(
      context({
        progression: [
          progressionItem({ exerciseName: "Barbell Bench Press" }),
          progressionItem({ exerciseName: "Overhead Press" }),
        ],
      }),
    );
    const filtered = filterNotificationDrafts(drafts, context({}));
    expect(filtered.filter((draft) => draft.category === "progression")).toHaveLength(1);
  });

  it("respects the five-per-week non-system cap", () => {
    const existing = Array.from({ length: 5 }, () => ({
      category: "motivation",
      created_at: "2026-09-05T10:00:00.000Z",
    }));
    const drafts = buildWorkoutNotifications(context({ workoutsThisWeek: 4 }));
    const filtered = filterNotificationDrafts(drafts, context({ workoutsThisWeek: 4, existing }));
    expect(filtered).toHaveLength(0);
  });

  it("honours the per-category enable flags", () => {
    const drafts = buildWorkoutNotifications(context({ progression: [progressionItem({})] }));
    const filtered = filterNotificationDrafts(
      drafts,
      context({
        progression: [progressionItem({})],
        prefs: { ...prefs, enableProgression: false },
      }),
    );
    expect(filtered).toHaveLength(0);
  });

  it("suppresses non-critical drafts during quiet hours", () => {
    const drafts = buildWorkoutNotifications(context({ workoutsThisWeek: 3 }));
    const filtered = filterNotificationDrafts(
      drafts,
      context({
        workoutsThisWeek: 3,
        now: new Date("2026-09-08T23:30:00"),
        prefs: { ...prefs, quietHoursStart: "22:00:00", quietHoursEnd: "07:00:00" },
      }),
    );
    expect(filtered).toHaveLength(0);
  });
});

describe("isWithinQuietHours", () => {
  it("handles windows that wrap past midnight", () => {
    expect(isWithinQuietHours(new Date("2026-09-08T23:30:00"), "22:00:00", "07:00:00")).toBe(true);
    expect(isWithinQuietHours(new Date("2026-09-08T12:00:00"), "22:00:00", "07:00:00")).toBe(false);
  });
  it("returns false when either bound is missing", () => {
    expect(isWithinQuietHours(new Date(), null, "07:00:00")).toBe(false);
  });
});
