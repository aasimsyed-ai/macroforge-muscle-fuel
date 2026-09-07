import { Activity, Dumbbell, Flame, HeartPulse, Layers, Timer } from "lucide-react";

import { StatCard } from "@/components/app/StatCard";
import type { WorkoutRangeStats } from "@/lib/workouts/api";

function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

export function WorkoutSummaryCards({ stats }: { stats: WorkoutRangeStats }) {
  const calorieLabel =
    stats.calories.value === null || (!stats.calories.anyWearable && !stats.calories.anyEstimated)
      ? "—"
      : `${stats.calories.value.toLocaleString()} kcal`;
  const calorieHint = stats.calories.anyWearable
    ? stats.calories.anyEstimated
      ? "Wearable + estimated sessions"
      : "From wearable"
    : stats.calories.anyEstimated
      ? "Estimated from body weight"
      : "No calorie data";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Workouts"
        value={stats.workouts}
        icon={<Dumbbell className="size-4" />}
        hint={stats.muscleGroups.length ? stats.muscleGroups.join(", ") : "No sessions in range"}
      />
      <StatCard
        label="Total time"
        value={formatDuration(stats.totalDurationMinutes)}
        icon={<Timer className="size-4" />}
        hint="Logged duration"
      />
      <StatCard
        label="Calories burned"
        value={calorieLabel}
        icon={<Flame className="size-4" />}
        hint={calorieHint}
      />
      <StatCard
        label="External-load volume"
        value={`${Math.round(stats.totalVolume).toLocaleString()} kg`}
        icon={<Layers className="size-4" />}
        hint="Reps × weight, completed sets"
      />
      <StatCard
        label="Completed sets"
        value={stats.totalSets > 0 ? `${stats.completedSets}/${stats.totalSets}` : "—"}
        icon={<Activity className="size-4" />}
        hint="Across all exercises"
      />
      <StatCard
        label="Avg heart rate"
        value={stats.averageHeartRate ? `${stats.averageHeartRate} bpm` : "—"}
        icon={<HeartPulse className="size-4" />}
        hint="From sessions with HR logged"
      />
    </div>
  );
}
