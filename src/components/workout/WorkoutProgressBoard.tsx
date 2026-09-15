import { useState } from "react";
import { HelpCircle, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { SectionGuide } from "@/components/app/SectionGuide";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveProgressBoardWindow,
  type ExerciseProgressStatus,
  type ProgressBoardPeriod,
} from "@/lib/workouts/calculations";
import { useExerciseProgressBoard } from "@/lib/workouts/hooks";

const PERIODS: ReadonlyArray<{ value: ProgressBoardPeriod; label: string }> = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
];

const STATUS_META: Record<
  ExerciseProgressStatus,
  { label: string; badge: "default" | "secondary" | "destructive" | "outline"; Icon: typeof TrendingUp }
> = {
  progressed: { label: "Progressed", badge: "default", Icon: TrendingUp },
  maintained: { label: "Maintained", badge: "secondary", Icon: Minus },
  decreased: { label: "Decreased", badge: "destructive", Icon: TrendingDown },
  insufficient_data: { label: "Not enough data", badge: "outline", Icon: HelpCircle },
};

function periodSummary(stats: { completedSets: number; topWeightKg: number | null; repsAtTopWeight: number | null; averageReps: number | null }): string {
  if (stats.completedSets === 0) return "no sets";
  if (stats.topWeightKg != null) return `${stats.topWeightKg} kg × ${stats.repsAtTopWeight} reps · ${stats.completedSets} sets`;
  if (stats.averageReps != null) return `${stats.averageReps} reps avg · ${stats.completedSets} sets`;
  return `${stats.completedSets} sets`;
}

/**
 * The main purpose of workout tracking: is the user actually progressing,
 * exercise by exercise, muscle group by muscle group — not a generic volume
 * chart. Each row compares the selected period against the one right before
 * it (independently per exercise; no cross-exercise or cross-muscle-group
 * suppression lives here or anywhere it reads from).
 */
export function WorkoutProgressBoard() {
  const [period, setPeriod] = useState<ProgressBoardPeriod>("this_week");
  const window = resolveProgressBoardWindow(period, new Date());
  const board = useExerciseProgressBoard(period);

  const rows = board.data ?? [];
  const trainedCount = rows.filter((row) => row.current.completedSets > 0).length;
  const progressedCount = rows.filter((row) => row.comparison.status === "progressed").length;

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <div>
            <p className="text-sm font-semibold">Progressive overload</p>
            <p className="text-xs text-muted-foreground">{window.label}</p>
          </div>
          <SectionGuide section="progress" />
        </div>
        <div className="flex gap-1 rounded-md bg-secondary p-1 text-xs">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              aria-pressed={period === item.value}
              className={`rounded px-2 py-1 transition-colors ${
                period === item.value ? "bg-card font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {board.isLoading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : board.isError ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Could not load progression data. If you just enabled workout tracking, the database
          migration may not be applied yet.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No workouts logged in this window yet. Log a session to start tracking progression.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            {trainedCount} exercise{trainedCount === 1 ? "" : "s"} trained this period ·{" "}
            {progressedCount} progressing
          </p>
          <ul className="mt-2 space-y-2">
            {rows.map((row) => {
              const meta = STATUS_META[row.comparison.status];
              const Icon = meta.Icon;
              return (
                <li
                  key={`${row.muscleGroup}::${row.exerciseName}`}
                  className="rounded-lg border border-border bg-background/40 p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.exerciseName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.muscleGroup}</p>
                    </div>
                    <Badge variant={meta.badge} className="shrink-0 gap-1">
                      <Icon className="size-3" aria-hidden="true" />
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {periodSummary(row.current)}
                    {row.previous.completedSets > 0 ? (
                      <span className="text-muted-foreground/70">
                        {" "}
                        (prev: {periodSummary(row.previous)})
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{row.comparison.explanation}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
