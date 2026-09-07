/**
 * Local "guest" mode.
 *
 * Lets someone use the whole app for a few days with no sign-up. Everything is
 * kept in localStorage on this device. When they create an account, the guest
 * data is pushed up to Supabase and the local copy is cleared.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DailyMetric, Goals, Meal, MealInput, MealUpdate, Profile } from "@/lib/data";

const KEY = "mf:guest:v1";
export const TRIAL_DAYS = 3;
const GUEST_USER = "guest-local";

type GuestBlob = {
  startedAt: string;
  profile: Profile;
  goals: Goals;
  meals: Meal[];
  metrics: DailyMetric[];
};

function now(): string {
  return new Date().toISOString();
}

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `g_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function read(): GuestBlob | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GuestBlob) : null;
  } catch {
    return null;
  }
}

function write(blob: GuestBlob): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(blob));
  } catch {
    // storage unavailable — nothing we can do
  }
}

function freshProfile(): Profile {
  return {
    id: GUEST_USER,
    age: 27,
    created_at: now(),
    display_name: null,
    goal_weight_kg: 70,
    height_cm: 170,
    onboarded: false,
    sex: null,
    start_weight_kg: 64,
    updated_at: now(),
  };
}

function freshGoals(): Goals {
  return {
    id: uid(),
    user_id: GUEST_USER,
    created_at: now(),
    updated_at: now(),
    is_active: true,
    calorie_target: 2550,
    protein_target_g: 130,
    carb_target_g: 320,
    fat_target_g: 70,
    water_target_ml: 3000,
    creatine_target_g: 5,
    sleep_target_hours: 7.5,
    workout_days_per_week: 5,
    goal_type: "lean_bulk",
    target_weight_kg: 70,
  };
}

/* ------------------------------- trial state ------------------------------- */

export function guestActive(): boolean {
  return read() !== null;
}

export function ensureGuest(): void {
  if (read()) return;
  write({ startedAt: now(), profile: freshProfile(), goals: freshGoals(), meals: [], metrics: [] });
}

export function guestDaysUsed(): number {
  const blob = read();
  if (!blob) return 0;
  return Math.floor((Date.now() - new Date(blob.startedAt).getTime()) / 86_400_000);
}

/** 1-based day of the trial, capped at TRIAL_DAYS. */
export function guestDayNumber(): number {
  return Math.min(TRIAL_DAYS, guestDaysUsed() + 1);
}

export function guestExpired(): boolean {
  return guestActive() && guestDaysUsed() >= TRIAL_DAYS;
}

export function clearGuest(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/* --------------------------------- reads ---------------------------------- */

export function guestGetProfile(): Profile {
  ensureGuest();
  return read()!.profile;
}

export function guestGetGoals(): Goals {
  ensureGuest();
  return read()!.goals;
}

export function guestListMeals(from: Date, to: Date): Meal[] {
  const blob = read();
  if (!blob) return [];
  const lo = from.getTime();
  const hi = to.getTime();
  return blob.meals
    .filter((m) => {
      const t = new Date(m.eaten_at).getTime();
      return t >= lo && t <= hi;
    })
    .sort((a, z) => new Date(z.eaten_at).getTime() - new Date(a.eaten_at).getTime());
}

export function guestAllMeals(): Meal[] {
  return (read()?.meals ?? [])
    .slice()
    .sort((a, z) => new Date(z.eaten_at).getTime() - new Date(a.eaten_at).getTime());
}

export function guestGetMeal(id: string): Meal | null {
  return read()?.meals.find((m) => m.id === id) ?? null;
}

export function guestAllMetrics(): DailyMetric[] {
  return (read()?.metrics ?? []).slice().sort((a, z) => a.metric_date.localeCompare(z.metric_date));
}

export function guestListMetrics(from: Date, to: Date): DailyMetric[] {
  const lo = from.toISOString().slice(0, 10);
  const hi = to.toISOString().slice(0, 10);
  return guestAllMetrics().filter((m) => m.metric_date >= lo && m.metric_date <= hi);
}

/* -------------------------------- writes --------------------------------- */

export function guestUpdateProfile(patch: Partial<Profile>): Profile {
  ensureGuest();
  const blob = read()!;
  blob.profile = { ...blob.profile, ...patch, updated_at: now() };
  write(blob);
  return blob.profile;
}

export function guestUpdateGoals(patch: Partial<Goals>): Goals {
  ensureGuest();
  const blob = read()!;
  blob.goals = { ...blob.goals, ...patch, updated_at: now() };
  write(blob);
  return blob.goals;
}

export function guestCreateMeal(input: Omit<MealInput, "photo">): Meal {
  ensureGuest();
  const blob = read()!;
  const meal: Meal = {
    id: uid(),
    user_id: GUEST_USER,
    created_at: now(),
    updated_at: now(),
    name: input.name,
    category: input.category,
    serving_amount: input.serving_amount,
    calories: input.calories,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    notes: input.notes,
    eaten_at: input.eaten_at,
    is_estimate: input.is_estimate,
    estimate_source: input.estimate_source,
    photo_path: null,
    is_demo: false,
  };
  blob.meals.unshift(meal);
  write(blob);
  return meal;
}

export function guestUpdateMeal(input: Omit<MealUpdate, "photo" | "photo_path">): Meal {
  const blob = read()!;
  const idx = blob.meals.findIndex((m) => m.id === input.id);
  if (idx < 0) throw new Error("Meal not found");
  const current = blob.meals[idx]!;
  const updated: Meal = {
    ...current,
    name: input.name,
    category: input.category,
    serving_amount: input.serving_amount,
    calories: input.calories,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    notes: input.notes,
    eaten_at: input.eaten_at,
    is_estimate: input.is_estimate,
    estimate_source: input.estimate_source,
    updated_at: now(),
  };
  blob.meals[idx] = updated;
  write(blob);
  return updated;
}

export function guestDeleteMeal(id: string): void {
  const blob = read();
  if (!blob) return;
  blob.meals = blob.meals.filter((m) => m.id !== id);
  write(blob);
}

export function guestSaveMetric(input: Partial<DailyMetric> & { metric_date: string }): DailyMetric {
  ensureGuest();
  const blob = read()!;
  const idx = blob.metrics.findIndex((m) => m.metric_date === input.metric_date);
  if (idx >= 0) {
    const merged: DailyMetric = { ...blob.metrics[idx]!, ...input, updated_at: now() };
    blob.metrics[idx] = merged;
    write(blob);
    return merged;
  }
  const row: DailyMetric = {
    id: uid(),
    user_id: GUEST_USER,
    created_at: now(),
    updated_at: now(),
    metric_date: input.metric_date,
    creatine_g: input.creatine_g ?? null,
    creatine_taken: input.creatine_taken ?? false,
    notes: input.notes ?? null,
    sleep_hours: input.sleep_hours ?? null,
    waist_cm: input.waist_cm ?? null,
    water_ml: input.water_ml ?? null,
    weight_kg: input.weight_kg ?? null,
    workout_minutes: input.workout_minutes ?? null,
    workout_type: input.workout_type ?? null,
  };
  blob.metrics.push(row);
  write(blob);
  return row;
}

/* ------------------------------- migration ------------------------------- */

/**
 * Copy the local guest data into Supabase for the just-signed-in user, then
 * clear the local copy. Safe to call when there is nothing to migrate.
 */
export async function migrateGuestToCloud(): Promise<boolean> {
  const blob = read();
  if (!blob) return false;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;

  try {
    await supabase.from("profiles").upsert({
      id: userId,
      age: blob.profile.age,
      display_name: blob.profile.display_name,
      goal_weight_kg: blob.profile.goal_weight_kg,
      height_cm: blob.profile.height_cm,
      onboarded: blob.profile.onboarded,
      sex: blob.profile.sex,
      start_weight_kg: blob.profile.start_weight_kg,
    });

    await supabase.from("goals").update({ is_active: false }).eq("user_id", userId);
    await supabase.from("goals").insert({
      user_id: userId,
      is_active: true,
      calorie_target: blob.goals.calorie_target,
      protein_target_g: blob.goals.protein_target_g,
      carb_target_g: blob.goals.carb_target_g,
      fat_target_g: blob.goals.fat_target_g,
      water_target_ml: blob.goals.water_target_ml,
      creatine_target_g: blob.goals.creatine_target_g,
      sleep_target_hours: blob.goals.sleep_target_hours,
      workout_days_per_week: blob.goals.workout_days_per_week,
      goal_type: blob.goals.goal_type,
      target_weight_kg: blob.goals.target_weight_kg,
    });

    if (blob.meals.length) {
      await supabase.from("meals").insert(
        blob.meals.map((m) => ({
          user_id: userId,
          name: m.name,
          category: m.category,
          serving_amount: m.serving_amount,
          calories: m.calories,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
          notes: m.notes,
          eaten_at: m.eaten_at,
          is_estimate: m.is_estimate,
          estimate_source: m.estimate_source,
        })),
      );
    }

    if (blob.metrics.length) {
      await supabase.from("daily_metrics").upsert(
        blob.metrics.map((m) => ({
          user_id: userId,
          metric_date: m.metric_date,
          creatine_g: m.creatine_g,
          creatine_taken: m.creatine_taken,
          notes: m.notes,
          sleep_hours: m.sleep_hours,
          waist_cm: m.waist_cm,
          water_ml: m.water_ml,
          weight_kg: m.weight_kg,
          workout_minutes: m.workout_minutes,
          workout_type: m.workout_type,
        })),
        { onConflict: "user_id,metric_date" },
      );
    }
  } finally {
    clearGuest();
  }
  return true;
}
