import { Plus, Trash2 } from "lucide-react";

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
import { MUSCLE_GROUPS } from "@/lib/workouts/constants";
import type {
  ExerciseCatalogItem,
  WorkoutExerciseDraft,
  WorkoutSetDraft,
} from "@/lib/workouts/types";

import { WorkoutSetEditor } from "./WorkoutSetEditor";

function makeSet(setNumber: number, template?: WorkoutSetDraft): WorkoutSetDraft {
  return {
    setNumber,
    reps: template?.reps ?? 10,
    weightKg: template?.weightKg ?? null,
    weightMode: template?.weightMode ?? "external",
    rir: template?.rir ?? null,
    rpe: template?.rpe ?? null,
    completed: true,
    restSeconds: template?.restSeconds ?? null,
  };
}

export function newExerciseDraft(): WorkoutExerciseDraft {
  return {
    muscleGroup: "Chest",
    exerciseName: "",
    exerciseVariant: null,
    equipment: null,
    exerciseCatalogId: null,
    isBodyweight: false,
    sets: [makeSet(1)],
  };
}

export function WorkoutExerciseForm({
  exercise,
  index,
  catalog,
  onChange,
  onRemove,
  canRemove,
}: {
  exercise: WorkoutExerciseDraft;
  index: number;
  catalog: ExerciseCatalogItem[];
  onChange: (patch: Partial<WorkoutExerciseDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function renumber(sets: WorkoutSetDraft[]): WorkoutSetDraft[] {
    return sets.map((set, i) => ({ ...set, setNumber: i + 1 }));
  }

  function handleNameChange(name: string) {
    const match = catalog.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
    if (match) {
      onChange({
        exerciseName: match.name,
        muscleGroup: match.muscle_group,
        equipment: match.equipment,
        exerciseCatalogId: match.id,
        isBodyweight: match.is_bodyweight,
      });
    } else {
      onChange({ exerciseName: name, exerciseCatalogId: null });
    }
  }

  function updateSet(setIndex: number, patch: Partial<WorkoutSetDraft>) {
    const next = exercise.sets.map((set, i) => (i === setIndex ? { ...set, ...patch } : set));
    onChange({ sets: next });
  }

  function addSet() {
    const last = exercise.sets[exercise.sets.length - 1];
    onChange({ sets: [...exercise.sets, makeSet(exercise.sets.length + 1, last)] });
  }

  function removeSet(setIndex: number) {
    if (exercise.sets.length <= 1) return;
    onChange({ sets: renumber(exercise.sets.filter((_, i) => i !== setIndex)) });
  }

  return (
    <div className="panel space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Exercise {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Remove exercise ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`exercise-name-${index}`} className="text-xs">
            Exercise
          </Label>
          <Input
            id={`exercise-name-${index}`}
            list="workout-exercise-catalog"
            required
            placeholder="e.g. Barbell Bench Press"
            value={exercise.exerciseName}
            onChange={(event) => handleNameChange(event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`muscle-group-${index}`} className="text-xs">
            Muscle group
          </Label>
          <Select
            value={exercise.muscleGroup}
            onValueChange={(value) => onChange({ muscleGroup: value })}
          >
            <SelectTrigger id={`muscle-group-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MUSCLE_GROUPS.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`equipment-${index}`} className="text-xs">
            Equipment (optional)
          </Label>
          <Input
            id={`equipment-${index}`}
            list="workout-equipment-options"
            placeholder="Select or type — Barbell, Dumbbell…"
            value={exercise.equipment ?? ""}
            onChange={(event) => onChange({ equipment: event.target.value.trim() || null })}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`variant-${index}`} className="text-xs">
            Variant (optional)
          </Label>
          <Input
            id={`variant-${index}`}
            list="workout-variant-options"
            placeholder="Select or type — Incline, Close-Grip…"
            value={exercise.exerciseVariant ?? ""}
            onChange={(event) => onChange({ exerciseVariant: event.target.value.trim() || null })}
          />
        </div>
      </div>

      <div className="space-y-2">
        {exercise.sets.map((set, setIndex) => (
          <WorkoutSetEditor
            key={setIndex}
            set={set}
            canRemove={exercise.sets.length > 1}
            onChange={(patch) => updateSet(setIndex, patch)}
            onRemove={() => removeSet(setIndex)}
          />
        ))}
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={addSet}>
        <Plus className="size-4" /> Add set
      </Button>
    </div>
  );
}
