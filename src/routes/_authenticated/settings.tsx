import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGoals, useProfile, useUpdateGoals, useUpdateProfile } from "@/lib/data";
import { GOAL_TYPES } from "@/lib/nutrition";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Targets — MacroForge" },
      {
        name: "description",
        content: "Set your calorie, protein, macro, water, creatine and sleep targets plus body stats and goal.",
      },
      { property: "og:title", content: "Settings & Targets — MacroForge" },
      { property: "og:description", content: "Configure daily targets and body stats for your lean-bulk plan." },
    ],
  }),
  component: SettingsPage,
});

const GOAL_FIELDS = [
  { key: "calorie_target", label: "Calories (kcal/day)", step: "10" },
  { key: "protein_target_g", label: "Protein (g/day)", step: "1" },
  { key: "carb_target_g", label: "Carbs (g/day)", step: "1" },
  { key: "fat_target_g", label: "Fat (g/day)", step: "1" },
  { key: "water_target_ml", label: "Water (ml/day)", step: "50" },
  { key: "creatine_target_g", label: "Creatine (g/day)", step: "0.5" },
  { key: "sleep_target_hours", label: "Sleep (hours/night)", step: "0.5" },
  { key: "workout_days_per_week", label: "Workouts per week", step: "1" },
  { key: "target_weight_kg", label: "Target weight (kg)", step: "0.1" },
] as const;

const PROFILE_FIELDS = [
  { key: "height_cm", label: "Height (cm)", step: "0.5" },
  { key: "age", label: "Age", step: "1" },
  { key: "start_weight_kg", label: "Starting weight (kg)", step: "0.1" },
  { key: "goal_weight_kg", label: "Goal weight (kg)", step: "0.1" },
] as const;

function SettingsPage() {
  const profile = useProfile();
  const goals = useGoals();
  const updateProfile = useUpdateProfile();
  const updateGoals = useUpdateGoals();

  const [goalForm, setGoalForm] = useState<Record<string, string>>({});
  const [goalType, setGoalType] = useState("lean_bulk");
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!goals.data) return;
    const next: Record<string, string> = {};
    for (const f of GOAL_FIELDS) {
      const v = goals.data[f.key as keyof typeof goals.data];
      next[f.key] = v === null || v === undefined ? "" : String(v);
    }
    setGoalForm(next);
    setGoalType(goals.data.goal_type ?? "lean_bulk");
  }, [goals.data]);

  useEffect(() => {
    if (!profile.data) return;
    const next: Record<string, string> = {};
    for (const f of PROFILE_FIELDS) {
      const v = profile.data[f.key as keyof typeof profile.data];
      next[f.key] = v === null || v === undefined ? "" : String(v);
    }
    setProfileForm(next);
    setDisplayName(profile.data.display_name ?? "");
  }, [profile.data]);

  const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v));

  async function saveGoals(e: React.FormEvent) {
    e.preventDefault();
    if (!goals.data) return;
    try {
      await updateGoals.mutateAsync({
        id: goals.data.id,
        calorie_target: num(goalForm["calorie_target"]) ?? 2550,
        protein_target_g: num(goalForm["protein_target_g"]) ?? 130,
        carb_target_g: num(goalForm["carb_target_g"]) ?? 320,
        fat_target_g: num(goalForm["fat_target_g"]) ?? 70,
        water_target_ml: num(goalForm["water_target_ml"]) ?? 3000,
        creatine_target_g: num(goalForm["creatine_target_g"]) ?? 5,
        sleep_target_hours: num(goalForm["sleep_target_hours"]) ?? 7.5,
        workout_days_per_week: num(goalForm["workout_days_per_week"]) ?? 5,
        target_weight_kg: num(goalForm["target_weight_kg"]) ?? 70,
        goal_type: goalType,
      });
      toast.success("Targets updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save targets");
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        display_name: displayName.trim() || null,
        height_cm: num(profileForm["height_cm"]),
        age: num(profileForm["age"]),
        start_weight_kg: num(profileForm["start_weight_kg"]),
        goal_weight_kg: num(profileForm["goal_weight_kg"]),
        onboarded: true,
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    }
  }

  return (
    <AppShell title="Settings" subtitle="Your targets and body stats — change them any time">
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="panel space-y-4 p-4">
          <div>
            <h2 className="text-lg font-semibold">You</h2>
            <p className="text-xs text-muted-foreground">Used for context on your trends.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_name">Name</Label>
            <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PROFILE_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key} className="text-xs">
                  {f.label}
                </Label>
                <Input
                  id={f.key}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={f.step}
                  value={profileForm[f.key] ?? ""}
                  onChange={(e) => setProfileForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>

        <form onSubmit={saveGoals} className="panel space-y-4 p-4">
          <div>
            <h2 className="text-lg font-semibold">Daily targets</h2>
            <p className="text-xs text-muted-foreground">Defaults start at 2,550 kcal and 130 g protein.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal_type">Goal</Label>
            <Select value={goalType} onValueChange={setGoalType}>
              <SelectTrigger id="goal_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {GOAL_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key} className="text-xs">
                  {f.label}
                </Label>
                <Input
                  id={f.key}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={f.step}
                  value={goalForm[f.key] ?? ""}
                  onChange={(e) => setGoalForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button type="submit" className="w-full" disabled={updateGoals.isPending || !goals.data}>
            {updateGoals.isPending ? "Saving…" : "Save targets"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
