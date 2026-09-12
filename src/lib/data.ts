import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  guestActive,
  guestAllMeals,
  guestAllMetrics,
  guestCreateMeal,
  guestDeleteMeal,
  guestGetGoals,
  guestGetMeal,
  guestGetProfile,
  guestListMeals,
  guestListMetrics,
  guestSaveMetric,
  guestUpdateGoals,
  guestUpdateMeal,
  guestUpdateProfile,
} from "@/lib/guest";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Goals = Database["public"]["Tables"]["goals"]["Row"];
export type Meal = Database["public"]["Tables"]["meals"]["Row"];
export type DailyMetric = Database["public"]["Tables"]["daily_metrics"]["Row"];

export const DEFAULT_GOALS = {
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

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You are signed out. Please sign in again.");
  return data.user.id;
}

/* ---------------------------------- profile --------------------------------- */

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      if (guestActive()) return guestGetProfile();
      const userId = await requireUserId();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return created;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (guestActive()) return guestUpdateProfile(patch);
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

/* ----------------------------------- goals ---------------------------------- */

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async (): Promise<Goals> => {
      if (guestActive()) return guestGetGoals();
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: insertError } = await supabase
        .from("goals")
        .insert({ user_id: userId, ...DEFAULT_GOALS })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return created;
    },
  });
}

export function useUpdateGoals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Goals> & { id: string }) => {
      const { id, ...rest } = patch;
      if (guestActive()) return guestUpdateGoals(rest);
      const { data, error } = await supabase.from("goals").update(rest).eq("id", id).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

/* ----------------------------------- meals ---------------------------------- */

export function useMeals(from: Date, to: Date, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meals", from.toISOString(), to.toISOString()],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<Meal[]> => {
      if (guestActive()) return guestListMeals(from, to);
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", userId)
        .gte("eaten_at", from.toISOString())
        .lte("eaten_at", to.toISOString())
        .order("eaten_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type MealInput = {
  name: string;
  category: string;
  serving_amount: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes: string | null;
  eaten_at: string;
  is_estimate: boolean;
  estimate_source: string | null;
  photo?: File | null;
};

export async function uploadMealPhoto(file: File): Promise<string> {
  const userId = await requireUserId();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("meal-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function useCreateMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MealInput) => {
      const { photo, ...rest } = input;
      if (guestActive()) return guestCreateMeal(rest);
      const userId = await requireUserId();
      const photo_path = photo ? await uploadMealPhoto(photo) : null;
      const { data, error } = await supabase
        .from("meals")
        .insert({ ...rest, photo_path, user_id: userId })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (guestActive()) return guestDeleteMeal(id);
      const { error } = await supabase.from("meals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

/** Load a single meal by id — used by the edit flow. */
export function useMeal(id: string | null) {
  return useQuery({
    queryKey: ["meal", id],
    enabled: !!id,
    queryFn: async (): Promise<Meal | null> => {
      if (!id) return null;
      if (guestActive()) return guestGetMeal(id);
      await requireUserId();
      const { data, error } = await supabase.from("meals").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type MealUpdate = Omit<MealInput, "photo"> & {
  id: string;
  photo?: File | null;
  /** Existing stored path, kept when no new photo is chosen. */
  photo_path?: string | null;
};

export function useUpdateMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MealUpdate) => {
      const { id, photo, photo_path, ...rest } = input;
      if (guestActive()) return guestUpdateMeal({ id, ...rest });
      const nextPath = photo ? await uploadMealPhoto(photo) : (photo_path ?? null);
      const { data, error } = await supabase
        .from("meals")
        .update({ ...rest, photo_path: nextPath })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["meal"] });
    },
  });
}

export type MealTemplate = {
  name: string;
  category: string;
  serving_amount: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_estimate: boolean;
  estimate_source: string | null;
};

/**
 * Recent distinct meals for the "repeat a meal" picker. Dedupes by lower-cased
 * name, keeping the most recent version (and its portion / macros).
 */
export function useRecentMeals(limit = 12) {
  return useQuery({
    queryKey: ["meals", "recent-templates", limit],
    staleTime: 1000 * 60,
    queryFn: async (): Promise<MealTemplate[]> => {
      let rows: {
        name: string;
        category: string;
        serving_amount: string | null;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        is_estimate: boolean;
        estimate_source: string | null;
      }[];
      if (guestActive()) {
        rows = guestAllMeals();
      } else {
        const userId = await requireUserId();
        const { data, error } = await supabase
          .from("meals")
          .select(
            "name, category, serving_amount, calories, protein_g, carbs_g, fat_g, is_estimate, estimate_source, eaten_at",
          )
          .eq("user_id", userId)
          .order("eaten_at", { ascending: false })
          .limit(120);
        if (error) throw error;
        rows = data ?? [];
      }
      const seen = new Set<string>();
      const out: MealTemplate[] = [];
      for (const m of rows) {
        const key = m.name.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({
          name: m.name,
          category: m.category,
          serving_amount: m.serving_amount,
          calories: Number(m.calories),
          protein_g: Number(m.protein_g),
          carbs_g: Number(m.carbs_g),
          fat_g: Number(m.fat_g),
          is_estimate: m.is_estimate,
          estimate_source: m.estimate_source,
        });
        if (out.length >= limit) break;
      }
      return out;
    },
  });
}

export interface FrequentMealSourceRow {
  name: string;
  category: string;
  serving_amount: string | null;
  calories: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  is_estimate: boolean;
  estimate_source: string | null;
}

/**
 * Groups meal rows by lower-cased name and ranks by how many times each was
 * logged — distinct from useRecentMeals, which is purely recency-based. A
 * food logged only once isn't "frequent," so singles are excluded. `rows`
 * must already be ordered most-recent-first so each group keeps its latest
 * occurrence for display (name/portion/macros).
 */
export function rankMealsByFrequency(rows: FrequentMealSourceRow[], limit: number): MealTemplate[] {
  const byName = new Map<string, { count: number; latest: FrequentMealSourceRow }>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byName.set(key, { count: 1, latest: row });
    }
  }
  return [...byName.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ latest: m }) => ({
      name: m.name,
      category: m.category,
      serving_amount: m.serving_amount,
      calories: Number(m.calories),
      protein_g: Number(m.protein_g),
      carbs_g: Number(m.carbs_g),
      fat_g: Number(m.fat_g),
      is_estimate: m.is_estimate,
      estimate_source: m.estimate_source,
    }));
}

const FREQUENT_MEALS_WINDOW_DAYS = 90;

/**
 * Foods logged repeatedly over time — the "Frequent" half of the Recent/
 * Frequent switch on Add Meal. Lazy: pass `enabled: false` until the user
 * actually asks for it, so viewing "Recent" (the default) never pays for
 * this query.
 */
export function useFrequentMeals(limit = 8, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meals", "frequent-templates", limit],
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<MealTemplate[]> => {
      if (guestActive()) {
        return rankMealsByFrequency(guestAllMeals(), limit);
      }
      const userId = await requireUserId();
      const since = new Date();
      since.setDate(since.getDate() - FREQUENT_MEALS_WINDOW_DAYS);
      const { data, error } = await supabase
        .from("meals")
        .select(
          "name, category, serving_amount, calories, protein_g, carbs_g, fat_g, is_estimate, estimate_source, eaten_at",
        )
        .eq("user_id", userId)
        .gte("eaten_at", since.toISOString())
        .order("eaten_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return rankMealsByFrequency(data ?? [], limit);
    },
  });
}

export function useMealPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ["meal-photo", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!path) return null;
      if (guestActive()) return null;
      const { data, error } = await supabase.storage.from("meal-photos").createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/* ------------------------------- daily metrics ------------------------------ */

export function useMetrics(from: Date, to: Date, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["metrics", format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<DailyMetric[]> => {
      if (guestActive()) return guestListMetrics(from, to);
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("user_id", userId)
        .gte("metric_date", format(from, "yyyy-MM-dd"))
        .lte("metric_date", format(to, "yyyy-MM-dd"))
        .order("metric_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllMetrics() {
  return useQuery({
    queryKey: ["metrics", "all"],
    queryFn: async (): Promise<DailyMetric[]> => {
      if (guestActive()) return guestAllMetrics();
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("user_id", userId)
        .order("metric_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<DailyMetric> & { metric_date: string }) => {
      if (guestActive()) return guestSaveMetric(input);
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("daily_metrics")
        .upsert({ ...input, user_id: userId }, { onConflict: "user_id,metric_date" })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["metrics"] }),
  });
}
