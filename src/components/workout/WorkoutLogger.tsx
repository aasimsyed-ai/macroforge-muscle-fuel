import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import * as workoutApi from "@/lib/workouts/api";
import { calculateSessionVolume, calculateWorkoutCalories } from "@/lib/workouts/calculations";
import { INTENSITIES } from "@/lib/workouts/constants";
import {
  useCreateWorkout,
  useExerciseCatalog,
  useRecentWorkoutSessions,
  useTrainingPreferences,
} from "@/lib/workouts/hooks";
import type {
  WorkoutExerciseDraft,
  WorkoutIntensity,
  WorkoutSessionDraft,
} from "@/lib/workouts/types";
import { validateWorkoutDraft } from "@/lib/workouts/validation";

import { WorkoutExerciseForm, newExerciseDraft } from "./WorkoutExerciseForm";
import { TrainingPhaseSelect } from "./TrainingPhaseSelect";

function initialDraft(): WorkoutSessionDraft {
  return {
    workoutDate: format(new Date(), "yyyy-MM-dd"),
    durationMinutes: null,
    intensity: "moderate",
    trainingPhase: "hypertrophy",
    notes: "",
    wearableCaloriesBurned: null,
    averageHeartRate: null,
    maxHeartRate: null,
    exercises: [newExerciseDraft()],
  };
}

function toNumberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function WorkoutLogger({
  bodyWeightKg,
  onSaved,
  onCancel,
}: {
  bodyWeightKg: number | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const catalog = useExerciseCatalog();
  const preferences = useTrainingPreferences();
  const recentSessions = useRecentWorkoutSessions();
  const create = useCreateWorkout();

  const [draft, setDraft] = useState<WorkoutSessionDraft>(initialDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [showWearable, setShowWearable] = useState(false);
  const [copyingSessionId, setCopyingSessionId] = useState<string | null>(null);
  // Bumped whenever `draft.exercises` is replaced wholesale (copy-from-previous,
  // post-save reset) so exercise/set rows remount and drop stale local UI state
  // (e.g. a weight input's "custom vs preset" toggle) instead of reusing it by index.
  const [draftVersion, setDraftVersion] = useState(0);
  const phaseTouched = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const prefs = preferences.data;
    if (!phaseTouched.current && prefs) {
      setDraft((current) => ({ ...current, trainingPhase: prefs.trainingPhase }));
    }
  }, [preferences.data]);

  const totalVolume = calculateSessionVolume(
    draft.exercises.map((exercise) => ({
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        weightKg: set.weightKg,
        weightMode: set.weightMode,
        completed: set.completed,
      })),
    })),
  );

  const calorieEstimate = calculateWorkoutCalories({
    bodyWeightKg,
    durationMinutes: draft.durationMinutes,
    intensity: draft.intensity,
    averageHeartRate: draft.averageHeartRate,
    wearableCalories: draft.wearableCaloriesBurned,
  });

  function patchExercise(index: number, patch: Partial<WorkoutExerciseDraft>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, i) =>
        i === index ? { ...exercise, ...patch } : exercise,
      ),
    }));
  }

  function addExercise() {
    setDraft((current) => ({ ...current, exercises: [...current.exercises, newExerciseDraft()] }));
  }

  async function copyFromSession(sessionId: string) {
    if (!sessionId) return;
    setCopyingSessionId(sessionId);
    try {
      const detail = await workoutApi.fetchWorkoutSessionById(sessionId);
      if (!detail || detail.exercises.length === 0) {
        toast.error("That workout has no exercises to copy.");
        return;
      }
      const exercises = workoutApi.sessionDetailToExerciseDrafts(detail);
      setDraft((current) => ({ ...current, exercises }));
      setDraftVersion((v) => v + 1);
      toast.success("Loaded — update the weights and save.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load that workout.");
    } finally {
      setCopyingSessionId(null);
    }
  }

  function removeExercise(index: number) {
    setDraft((current) => ({
      ...current,
      exercises:
        current.exercises.length > 1
          ? current.exercises.filter((_, i) => i !== index)
          : current.exercises,
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current || create.isPending) return;

    const result = validateWorkoutDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }
    setErrors([]);
    submittingRef.current = true;
    try {
      await create.mutateAsync({ draft, bodyWeightKg });
      toast.success("Workout saved");
      setDraft(initialDraft());
      setDraftVersion((v) => v + 1);
      phaseTouched.current = false;
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the workout");
    } finally {
      submittingRef.current = false;
    }
  }

  const saving = create.isPending;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="workout-date" className="text-xs">
            Date
          </Label>
          <Input
            id="workout-date"
            type="date"
            value={draft.workoutDate}
            onChange={(event) => setDraft((c) => ({ ...c, workoutDate: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="workout-phase" className="text-xs">
            Training phase
          </Label>
          <TrainingPhaseSelect
            id="workout-phase"
            value={draft.trainingPhase}
            onChange={(value) => {
              phaseTouched.current = true;
              setDraft((c) => ({ ...c, trainingPhase: value }));
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="workout-intensity" className="text-xs">
            Intensity
          </Label>
          <Select
            value={draft.intensity}
            onValueChange={(value) =>
              setDraft((c) => ({ ...c, intensity: value as WorkoutIntensity }))
            }
          >
            <SelectTrigger id="workout-intensity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTENSITIES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="workout-duration" className="text-xs">
            Duration (minutes)
          </Label>
          <Input
            id="workout-duration"
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            placeholder="60"
            value={draft.durationMinutes === null ? "" : String(draft.durationMinutes)}
            onChange={(event) =>
              setDraft((c) => ({ ...c, durationMinutes: toNumberOrNull(event.target.value) }))
            }
          />
        </div>
      </div>

      {recentSessions.data && recentSessions.data.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-dashed border-border p-3">
          <Label htmlFor="copy-previous-workout" className="text-xs">
            Copy from a previous workout
          </Label>
          <Select
            value=""
            disabled={copyingSessionId !== null}
            onValueChange={(value) => void copyFromSession(value)}
          >
            <SelectTrigger id="copy-previous-workout">
              <SelectValue
                placeholder={
                  copyingSessionId ? "Loading…" : "Select a past workout to reuse its exercises"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {recentSessions.data.map((session) => {
                const names = session.exerciseNames;
                const label =
                  names.length > 3
                    ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more`
                    : names.join(", ") || "No exercises";
                return (
                  <SelectItem key={session.id} value={session.id}>
                    {format(new Date(`${session.workoutDate}T00:00:00`), "d MMM")} — {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Loads the same exercises and sets so you only need to update weights and reps.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Exercises</p>
          {catalog.isError ? (
            <span className="text-[11px] text-muted-foreground">Exercise list unavailable</span>
          ) : null}
        </div>
        {draft.exercises.map((exercise, index) => (
          <WorkoutExerciseForm
            key={`${draftVersion}-${index}`}
            index={index}
            exercise={exercise}
            catalog={catalog.data ?? []}
            canRemove={draft.exercises.length > 1}
            onChange={(patch) => patchExercise(index, patch)}
            onRemove={() => removeExercise(index)}
          />
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addExercise}>
          <Plus className="size-4" /> Add exercise
        </Button>
      </div>

      <div className="rounded-lg border border-dashed border-border p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-xs font-medium"
          aria-expanded={showWearable}
          onClick={() => setShowWearable((value) => !value)}
        >
          <span>Wearable metrics (optional)</span>
          <span className="text-muted-foreground">{showWearable ? "Hide" : "Add"}</span>
        </button>
        {showWearable ? (
          <div className="mt-3 space-y-3">
            <p className="rounded-md bg-secondary p-2 text-[11px] text-muted-foreground">
              Wearable synchronization is not configured yet. Manual workout tracking remains
              available. Values entered here are treated as approximate and never combined with the
              estimate.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="avg-hr" className="text-[11px]">
                  Avg HR
                </Label>
                <Input
                  id="avg-hr"
                  type="number"
                  inputMode="numeric"
                  min={30}
                  max={240}
                  value={draft.averageHeartRate === null ? "" : String(draft.averageHeartRate)}
                  onChange={(event) =>
                    setDraft((c) => ({ ...c, averageHeartRate: toNumberOrNull(event.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="max-hr" className="text-[11px]">
                  Max HR
                </Label>
                <Input
                  id="max-hr"
                  type="number"
                  inputMode="numeric"
                  min={30}
                  max={260}
                  value={draft.maxHeartRate === null ? "" : String(draft.maxHeartRate)}
                  onChange={(event) =>
                    setDraft((c) => ({ ...c, maxHeartRate: toNumberOrNull(event.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wearable-cal" className="text-[11px]">
                  Wearable kcal
                </Label>
                <Input
                  id="wearable-cal"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={
                    draft.wearableCaloriesBurned === null
                      ? ""
                      : String(draft.wearableCaloriesBurned)
                  }
                  onChange={(event) =>
                    setDraft((c) => ({
                      ...c,
                      wearableCaloriesBurned: toNumberOrNull(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="workout-notes" className="text-xs">
          Notes
        </Label>
        <Textarea
          id="workout-notes"
          rows={2}
          placeholder="How it felt, what to change next time…"
          value={draft.notes}
          onChange={(event) => setDraft((c) => ({ ...c, notes: event.target.value }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-secondary px-3 py-2 text-xs">
        <span>
          External-load volume: <strong>{Math.round(totalVolume).toLocaleString()} kg</strong>
        </span>
        <span>
          Calories:{" "}
          <strong>
            {calorieEstimate.calories === null ? "—" : `${calorieEstimate.calories} kcal`}
          </strong>{" "}
          <span className="text-muted-foreground">
            (
            {calorieEstimate.source === "wearable"
              ? "wearable"
              : calorieEstimate.source === "estimated"
                ? "estimated"
                : "unavailable"}
            )
          </span>
        </span>
      </div>

      {errors.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {errors.map((message) => (
            <li key={message} className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Saving…" : "Save workout"}
        </Button>
      </div>
    </form>
  );
}
