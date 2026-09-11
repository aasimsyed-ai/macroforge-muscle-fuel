import { supabase } from "@/integrations/supabase/client";
import { guestActive, guestAllMeals } from "@/lib/guest";
import { aggregateDailyProtein, countProteinHitDays } from "@/lib/streaks";
import {
  createNotificationIfAbsent,
  fetchNotificationPreferences,
  fetchNotifications,
  type NotificationDraft,
} from "@/lib/workouts/api";
import { filterNotificationDrafts, type NotificationContext } from "@/lib/workouts/notifications";

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/**
 * Days the protein target was hit, over a wider window than the 90-day
 * streak lookback (bounded, but generous enough that a slow-and-steady user
 * — say one hit every ~2 weeks — can still reach "hit 20 times" without
 * older hits ageing out of a short window). Its own query, decoupled from
 * the streak window, since the two have different needs.
 */
export async function fetchProteinHitDays(proteinTarget: number, days = 400): Promise<number> {
  if (proteinTarget <= 0) return 0;
  if (guestActive()) {
    return countProteinHitDays(aggregateDailyProtein(guestAllMeals()), proteinTarget);
  }
  const userId = await requireUserId();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await supabase
    .from("meals")
    .select("eaten_at, protein_g")
    .eq("user_id", userId)
    .gte("eaten_at", from.toISOString());
  if (error) throw error;
  return countProteinHitDays(aggregateDailyProtein(data ?? []), proteinTarget);
}

export interface MilestoneContext {
  totalMeals: number;
  totalWorkouts: number;
  loggingStreak: number;
  /** Days the protein target was hit — see fetchProteinHitDays for the (wider than streaks) lookback window. */
  proteinHitDays: number;
}

/** Cheap counts — head-only queries, no rows fetched. */
export async function fetchMilestoneCounts(): Promise<{ totalMeals: number; totalWorkouts: number }> {
  if (guestActive()) {
    return { totalMeals: guestAllMeals().length, totalWorkouts: 0 };
  }
  const userId = await requireUserId();
  const [meals, workouts] = await Promise.all([
    supabase.from("meals").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (meals.error) throw meals.error;
  // A missing workout_sessions table (migration not applied yet) shouldn't
  // block food-side milestones — treat it as zero workouts instead of throwing.
  const totalWorkouts = workouts.error ? 0 : (workouts.count ?? 0);
  return { totalMeals: meals.count ?? 0, totalWorkouts };
}

interface MilestoneDef {
  dedupeKey: string;
  title: string;
  message: string;
  reached: (ctx: MilestoneContext) => boolean;
}

const MILESTONES: MilestoneDef[] = [
  {
    dedupeKey: "milestone:first-7-days",
    title: "First 7 days 🔥",
    message: "You've logged 7 days in a row. That's the hardest part of a new habit — done.",
    reached: (ctx) => ctx.loggingStreak >= 7,
  },
  {
    dedupeKey: "milestone:30-day-consistency",
    title: "30-day consistency 🔥",
    message: "A full month of consistent logging. This is genuinely rare — keep going.",
    reached: (ctx) => ctx.loggingStreak >= 30,
  },
  {
    dedupeKey: "milestone:10-workouts",
    title: "10 workouts logged 💪",
    message: "Ten structured sessions in the books.",
    reached: (ctx) => ctx.totalWorkouts >= 10,
  },
  {
    dedupeKey: "milestone:100-meals",
    title: "100 meals logged 🍽️",
    message: "A hundred meals tracked — your data is genuinely useful now.",
    reached: (ctx) => ctx.totalMeals >= 100,
  },
  {
    dedupeKey: "milestone:protein-20",
    title: "Protein target hit 20 times 🥩",
    message: "20 days at or above your protein target.",
    reached: (ctx) => ctx.proteinHitDays >= 20,
  },
];

/** Pure: which milestones does this context satisfy. */
export function buildMilestoneDrafts(ctx: MilestoneContext): NotificationDraft[] {
  return MILESTONES.filter((m) => m.reached(ctx)).map((m) => ({
    category: "motivation",
    priority: "normal",
    title: m.title,
    message: m.message,
    dedupeKey: m.dedupeKey,
  }));
}

const SHOWN_PREFIX = "mf:milestone-shown:";
const RUN_KEY = "mf:milestone-check";
const RUN_INTERVAL_MS = 4 * 60 * 60 * 1000;

function alreadyShownLocally(key: string): boolean {
  try {
    return localStorage.getItem(SHOWN_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function markShownLocally(key: string) {
  try {
    localStorage.setItem(SHOWN_PREFIX + key, "1");
  } catch {
    // ignore — worst case the same milestone celebrates again on this device
  }
}

function shouldRunNow(force: boolean): boolean {
  if (force) return true;
  try {
    const last = Number(localStorage.getItem(RUN_KEY) ?? "0");
    return Date.now() - last > RUN_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markRun() {
  try {
    localStorage.setItem(RUN_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Checks milestones and persists any newly-reached ones (DB-deduped by
 * dedupe_key, same mechanism the workout notifications already use), routed
 * through the SAME filterNotificationDrafts used for workout notifications —
 * so milestones share the weekly non-system cap, the one-per-category-per-day
 * limit, quiet hours, and the per-category enable toggles, rather than
 * bypassing them. Returns only the ones genuinely new on THIS device, for
 * the caller to celebrate — throttled to roughly once every 4 hours so this
 * never becomes a hot path.
 */
export async function runMilestoneCheck(
  ctx: MilestoneContext,
  options: { force?: boolean } = {},
): Promise<NotificationDraft[]> {
  if (guestActive()) return [];
  if (!shouldRunNow(!!options.force)) return [];
  markRun();

  const candidates = buildMilestoneDrafts(ctx).filter((d) => !alreadyShownLocally(d.dedupeKey));
  if (candidates.length === 0) return [];

  let allowed: NotificationDraft[];
  try {
    const [prefs, existing] = await Promise.all([fetchNotificationPreferences(), fetchNotifications()]);
    const filterCtx: NotificationContext = {
      now: new Date(),
      prefs,
      workoutsThisWeek: 0,
      returnedAfterBreak: false,
      progression: [],
      existing: existing.map((row) => ({ category: row.category, created_at: row.created_at })),
    };
    allowed = filterNotificationDrafts(candidates, filterCtx);
  } catch {
    // Can't confirm the shared budget/quiet-hours state right now — skip
    // this run rather than risk over-notifying. It'll be re-evaluated next
    // time the throttle allows.
    return [];
  }

  const fresh: NotificationDraft[] = [];
  for (const draft of allowed) {
    try {
      await createNotificationIfAbsent(draft);
      markShownLocally(draft.dedupeKey);
      fresh.push(draft);
    } catch {
      // skip this one — don't let a single failed insert block the others
    }
  }
  return fresh;
}
