import {
  analyzeExerciseProgression,
  type ProgressionAnalysis,
} from "./calculations";
import * as api from "./api";
import type { NotificationDraft, NotificationPreferences } from "./api";
import type { TrainingPreferences } from "./types";

/** ISO-week string like "2026-W37", stable for dedupe keys that should re-fire weekly. */
export function isoWeekKey(date: Date): string {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(copy.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((copy.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function exerciseSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ExerciseProgressionResult extends ProgressionAnalysis {
  exerciseName: string;
}

export interface NotificationContext {
  now: Date;
  prefs: NotificationPreferences;
  workoutsThisWeek: number;
  returnedAfterBreak: boolean;
  progression: ExerciseProgressionResult[];
  existing: Array<{ category: string; created_at: string }>;
}

/** Pure: candidate notifications from the current training picture. */
export function buildWorkoutNotifications(ctx: NotificationContext): NotificationDraft[] {
  const week = isoWeekKey(ctx.now);
  const drafts: NotificationDraft[] = [];

  for (const item of ctx.progression) {
    const slug = exerciseSlug(item.exerciseName);
    if (!slug) continue;

    if (item.result === "ready_to_progress") {
      drafts.push({
        category: "progression",
        priority: "normal",
        title: "Time to add weight",
        message: `You have reached the top of your target rep range on ${item.exerciseName} across several sessions. Review the suggested next weight${
          item.suggestedWeightKg ? ` (${item.suggestedWeightKg} kg)` : ""
        }.`,
        dedupeKey: `progression:${slug}`,
        relatedExerciseName: item.exerciseName,
      });
    } else if (item.result === "deload_or_recover") {
      drafts.push({
        category: "recovery",
        priority: "normal",
        title: "Consider a lighter block",
        message: `Your performance on ${item.exerciseName} has declined across several sessions. Consider maintaining the current load and prioritizing recovery.`,
        dedupeKey: `recovery:${slug}:${week}`,
        relatedExerciseName: item.exerciseName,
      });
    } else if (item.result === "maintain") {
      drafts.push({
        category: "workout_guidance",
        priority: "low",
        title: "Keep building reps",
        message: `Keep the current weight on ${item.exerciseName} and focus on controlled repetitions toward the top of your target range.`,
        dedupeKey: `maintain:${slug}:${week}`,
        relatedExerciseName: item.exerciseName,
      });
    }
  }

  if (ctx.workoutsThisWeek >= 3) {
    drafts.push({
      category: "motivation",
      priority: "low",
      title: "Consistency is building",
      message: `You completed ${ctx.workoutsThisWeek} workouts this week. Your consistency is improving.`,
      dedupeKey: `motivation:consistency:${week}`,
    });
  }

  if (ctx.returnedAfterBreak) {
    drafts.push({
      category: "motivation",
      priority: "low",
      title: "Welcome back",
      message: "You returned to training after a break. Rebuilding consistency is a meaningful step.",
      dedupeKey: `motivation:return:${week}`,
    });
  }

  return drafts;
}

function categoryEnabled(
  category: NotificationDraft["category"],
  prefs: NotificationPreferences,
): boolean {
  if (category === "progression" || category === "workout_guidance") return prefs.enableProgression;
  if (category === "motivation") return prefs.enableMotivation;
  if (category === "recovery" || category === "safety") return prefs.enableHealth;
  return true;
}

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isWithinQuietHours(now: Date, start: string | null, end: string | null): boolean {
  const startMin = parseTime(start);
  const endMin = parseTime(end);
  if (startMin === null || endMin === null || startMin === endMin) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return startMin < endMin
    ? nowMin >= startMin && nowMin < endMin
    : nowMin >= startMin || nowMin < endMin;
}

/**
 * Pure: apply the spam rules — max one guidance notification per category per
 * day, max five non-system per rolling week, respect quiet hours for
 * non-critical items, and drop anything the user has turned off.
 */
export function filterNotificationDrafts(
  drafts: NotificationDraft[],
  ctx: NotificationContext,
): NotificationDraft[] {
  const todayKey = ctx.now.toISOString().slice(0, 10);
  const weekAgo = ctx.now.getTime() - 7 * 86400000;

  const nonSystemThisWeek = ctx.existing.filter(
    (row) => row.category !== "system" && new Date(row.created_at).getTime() >= weekAgo,
  ).length;
  const categoriesToday = new Set(
    ctx.existing
      .filter((row) => row.created_at.slice(0, 10) === todayKey)
      .map((row) => row.category),
  );
  const quiet = isWithinQuietHours(ctx.now, ctx.prefs.quietHoursStart, ctx.prefs.quietHoursEnd);

  let weeklyBudget = Math.max(0, 5 - nonSystemThisWeek);
  const emittedCategories = new Set<string>();
  const emittedKeys = new Set<string>();
  const out: NotificationDraft[] = [];

  for (const draft of drafts) {
    if (emittedKeys.has(draft.dedupeKey)) continue;
    if (!categoryEnabled(draft.category, ctx.prefs)) continue;
    if (categoriesToday.has(draft.category) || emittedCategories.has(draft.category)) continue;
    if (draft.priority !== "critical" && quiet) continue;
    if (draft.category !== "system") {
      if (weeklyBudget <= 0) continue;
      weeklyBudget -= 1;
    }
    emittedCategories.add(draft.category);
    emittedKeys.add(draft.dedupeKey);
    out.push(draft);
  }
  return out;
}

const RUN_KEY = "mf:workout:notif-run";
const RUN_INTERVAL_MS = 8 * 60 * 60 * 1000;

function shouldRunNow(): boolean {
  try {
    const last = Number(localStorage.getItem(RUN_KEY) ?? "0");
    return Date.now() - last > RUN_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markRun(): void {
  try {
    localStorage.setItem(RUN_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Fetch the training picture, build notifications and insert the new ones.
 * Safe to call often — throttled to roughly once every 8 hours per device, and
 * every insert is de-duplicated in the database.
 */
export async function runWorkoutNotifications(
  preferences: TrainingPreferences,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!options.force && !shouldRunNow()) return;
  markRun();

  const [summary, notifPrefs, existing, recentNames] = await Promise.all([
    api.fetchTrainingHistorySummary(),
    api.fetchNotificationPreferences(),
    api.fetchNotifications(),
    api.fetchRecentExerciseNames(4),
  ]);

  if (summary.totalSessions === 0) return;

  const progression: ExerciseProgressionResult[] = [];
  for (const name of recentNames) {
    try {
      const history = await api.fetchExerciseHistory(name);
      if (history.length === 0) continue;
      const analysis = analyzeExerciseProgression(history, preferences);
      if (analysis.result !== "insufficient_data") {
        progression.push({ ...analysis, exerciseName: name });
      }
    } catch {
      // skip this exercise
    }
  }

  const now = new Date();
  const weekAgo = now.getTime() - 7 * 86400000;
  const sessions = await api.fetchWorkoutSessions(
    new Date(weekAgo - 30 * 86400000).toISOString().slice(0, 10),
    now.toISOString().slice(0, 10),
  );
  const workoutsThisWeek = sessions.filter(
    (session) => new Date(`${session.workout_date}T00:00:00`).getTime() >= weekAgo,
  ).length;
  const lastBeforeThisWeek = sessions
    .filter((session) => new Date(`${session.workout_date}T00:00:00`).getTime() < weekAgo)
    .at(0);
  const returnedAfterBreak =
    workoutsThisWeek > 0 &&
    !!lastBeforeThisWeek &&
    now.getTime() - new Date(`${lastBeforeThisWeek.workout_date}T00:00:00`).getTime() >
      12 * 86400000;

  const ctx: NotificationContext = {
    now,
    prefs: notifPrefs,
    workoutsThisWeek,
    returnedAfterBreak,
    progression,
    existing: existing.map((row) => ({ category: row.category, created_at: row.created_at })),
  };

  const drafts = filterNotificationDrafts(buildWorkoutNotifications(ctx), ctx);
  for (const draft of drafts) {
    try {
      await api.createNotificationIfAbsent(draft);
    } catch {
      // ignore individual insert failures
    }
  }
}
