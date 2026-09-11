import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionDetailToDraft, type WorkoutSession } from "@/lib/workouts/api";
import { useDeleteWorkout, useWorkoutSession } from "@/lib/workouts/hooks";

import { WorkoutLogger } from "./WorkoutLogger";

function sessionCalories(session: WorkoutSession): string {
  if (session.calories_source === "wearable" && session.wearable_calories_burned != null) {
    return `${Math.round(Number(session.wearable_calories_burned))} kcal · wearable`;
  }
  if (session.calories_source === "estimated" && session.estimated_calories_burned != null) {
    return `${Math.round(Number(session.estimated_calories_burned))} kcal · estimated`;
  }
  return "kcal unavailable";
}

function SessionDetail({ id }: { id: string }) {
  const detail = useWorkoutSession(id);

  if (detail.isLoading) {
    return <Skeleton className="mt-2 h-16 w-full rounded-md" />;
  }
  if (detail.isError || !detail.data) {
    return <p className="mt-2 text-xs text-muted-foreground">Could not load this workout.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {detail.data.exercises.map((exercise) => (
        <div key={exercise.id} className="rounded-md bg-secondary/60 p-2 text-xs">
          <p className="font-medium">
            {exercise.exercise_name}
            {exercise.exercise_variant ? ` · ${exercise.exercise_variant}` : ""}
            <span className="text-muted-foreground"> · {exercise.muscle_group}</span>
          </p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {exercise.sets.map((set) => (
              <li key={set.id}>
                Set {set.set_number}: {set.reps} reps
                {set.weight_mode === "bodyweight"
                  ? set.weight_kg
                    ? ` · bodyweight + ${set.weight_kg} kg`
                    : " · bodyweight"
                  : set.weight_kg != null
                    ? ` · ${set.weight_kg} kg`
                    : ""}
                {set.rir != null ? ` · RIR ${set.rir}` : ""}
                {set.rpe != null ? ` · RPE ${set.rpe}` : ""}
                {set.completed ? "" : " · skipped"}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {detail.data.notes ? (
        <p className="text-xs text-muted-foreground">Notes: {detail.data.notes}</p>
      ) : null}
    </div>
  );
}

function EditSessionForm({
  id,
  bodyWeightKg,
  onDone,
}: {
  id: string;
  bodyWeightKg: number | null;
  onDone: () => void;
}) {
  const detail = useWorkoutSession(id);

  if (detail.isLoading) {
    return <Skeleton className="mt-2 h-40 w-full rounded-md" />;
  }
  if (detail.isError || !detail.data) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">Could not load this workout to edit.</p>
    );
  }

  return (
    <div className="mt-2">
      <WorkoutLogger
        bodyWeightKg={bodyWeightKg}
        initialData={{ sessionId: id, draft: sessionDetailToDraft(detail.data) }}
        onSaved={onDone}
        onCancel={onDone}
      />
    </div>
  );
}

export function WorkoutHistory({
  sessions,
  bodyWeightKg,
}: {
  sessions: WorkoutSession[];
  bodyWeightKg: number | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const remove = useDeleteWorkout();

  if (sessions.length === 0) {
    return (
      <p className="panel p-6 text-center text-sm text-muted-foreground">
        No workouts logged in this range yet.
      </p>
    );
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this workout? This cannot be undone.")) return;
    try {
      await remove.mutateAsync(id);
      if (openId === id) setOpenId(null);
      if (editingId === id) setEditingId(null);
      toast.success("Workout deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the workout");
    }
  }

  return (
    <ul className="space-y-2">
      {sessions.map((session) => {
        const open = openId === session.id;
        const editing = editingId === session.id;
        return (
          <li key={session.id} className="panel p-3">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="flex flex-1 items-start gap-2 text-left"
                aria-expanded={open || editing}
                onClick={() => setOpenId(open ? null : session.id)}
              >
                {open || editing ? (
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold">
                    {format(new Date(`${session.workout_date}T00:00:00`), "EEE d MMM yyyy")}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {session.intensity ? (
                      <Badge variant="secondary">{session.intensity}</Badge>
                    ) : null}
                    {session.training_phase ? (
                      <Badge variant="outline">{session.training_phase.replace(/_/g, " ")}</Badge>
                    ) : null}
                    {session.duration_minutes ? <span>{session.duration_minutes} min</span> : null}
                    <span>{Math.round(Number(session.total_volume)).toLocaleString()} kg volume</span>
                    <span>{sessionCalories(session)}</span>
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={editing ? "Cancel edit" : "Edit workout"}
                  aria-pressed={editing}
                  disabled={remove.isPending}
                  onClick={() => setEditingId(editing ? null : session.id)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Delete workout"
                  disabled={remove.isPending}
                  onClick={() => handleDelete(session.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            {editing ? (
              <EditSessionForm
                id={session.id}
                bodyWeightKg={bodyWeightKg}
                onDone={() => setEditingId(null)}
              />
            ) : open ? (
              <SessionDetail id={session.id} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
