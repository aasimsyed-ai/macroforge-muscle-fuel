import { format } from "date-fns";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useExerciseHistory } from "@/lib/workouts/hooks";
import {
  formatPreviousPerformance,
  pickPreviousSession,
  weightToReuse,
} from "@/lib/workouts/previousPerformance";

/**
 * One line under the exercise picker: what the user did last time on this
 * exercise, with a one-tap way to reuse that weight. Optional context — it
 * renders nothing while loading or if the history can't be fetched.
 */
export function PreviousPerformanceHint({
  exerciseName,
  beforeDate,
  isBodyweight,
  canReuseWeight,
  onReuseWeight,
}: {
  exerciseName: string;
  beforeDate: string;
  isBodyweight: boolean;
  /** True when at least one set of this exercise has no weight yet. */
  canReuseWeight: boolean;
  onReuseWeight: (weightKg: number) => void;
}) {
  const name = exerciseName.trim();
  const history = useExerciseHistory(name || null);
  if (!name || history.isLoading || history.isError || !history.data) return null;

  const previous = pickPreviousSession(history.data, beforeDate);
  if (!previous) {
    return (
      <p className="text-xs text-muted-foreground">
        First time logging this exercise — no previous session to compare with.
      </p>
    );
  }

  const reuse = weightToReuse(previous);
  const dateLabel = format(new Date(`${previous.date}T00:00:00`), "d MMM");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs">
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <History className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium text-foreground">Last time · {dateLabel}</span>
          {" — "}
          {formatPreviousPerformance(previous, isBodyweight)}
        </span>
      </span>
      {reuse !== null && canReuseWeight ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          aria-label={`Use ${reuse} kg from last time for sets without a weight`}
          onClick={() => onReuseWeight(reuse)}
        >
          Use {reuse} kg
        </Button>
      ) : null}
    </div>
  );
}
