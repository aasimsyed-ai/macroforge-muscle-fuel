import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
      const { data, error } = await supabase.from("goals").update(rest).eq("id", id).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

/* ----------------------------------- meals ---------------------------------- */

export function useMeals(from: Date, to: Date) {
  return useQuery({
    queryKey: ["meals", from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<Meal[]> => {
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
      const userId = await requireUserId();
      const { photo, ...rest } = input;
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
      const { error } = await supabase.from("meals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useMealPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ["meal-photo", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from("meal-photos").createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/* ------------------------------- daily metrics ------------------------------ */

export function useMetrics(from: Date, to: Date) {
  return useQuery({
    queryKey: ["metrics", format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")],
    queryFn: async (): Promise<DailyMetric[]> => {
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
