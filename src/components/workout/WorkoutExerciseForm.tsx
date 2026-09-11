import { useEffect, useMemo, useState } from "react";
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
import { EQUIPMENT_OPTIONS, MUSCLE_GROUPS, VARIANT_OPTIONS } from "@/lib/workouts/constants";
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
  const OTHER_VALUE = "__other__";
  const NONE_VALUE = "__none__";

  const exercisesForGroup = useMemo(
    () => catalog.filter((item) => item.muscle_group === exercise.muscleGroup),
    [catalog, exercise.muscleGroup],
  );

  const [otherMode, setOtherMode] = useState(
    () => !!exercise.exerciseName && !exercise.exerciseCatalogId,
  );

  useEffect(() => {
    if (!exercise.exerciseName) {
      setOtherMode(false);
      return;
    }
    if (exercise.exerciseCatalogId) {
      setOtherMode(false);
      return;
    }
    const matchesCatalog = catalog.some(
      (item) => item.muscle_group === exercise.muscleGroup && item.name === exercise.exerciseName,
    );
    setOtherMode(!matchesCatalog);
  }, [exercise.exerciseName, exercise.exerciseCatalogId, exercise.muscleGroup, catalog]);

  const [otherEquipment, setOtherEquipment] = useState(
    () => !!exercise.equipment && !EQUIPMENT_OPTIONS.includes(exercise.equipment as (typeof EQUIPMENT_OPTIONS)[number]),
  );
  const [otherVariant, setOtherVariant] = useState(
    () =>
      !!exercise.exerciseVariant &&
      !VARIANT_OPTIONS.includes(exercise.exerciseVariant as (typeof VARIANT_OPTIONS)[number]),
  );

  useEffect(() => {
    if (!exercise.equipment) {
      setOtherEquipment(false);
      return;
    }
    setOtherEquipment(
      !EQUIPMENT_OPTIONS.includes(exercise.equipment as (typeof EQUIPMENT_OPTIONS)[number]),
    );
  }, [exercise.equipment]);

  useEffect(() => {
    if (!exercise.exerciseVariant) {
      setOtherVariant(false);
      return;
    }
    setOtherVariant(
      !VARIANT_OPTIONS.includes(exercise.exerciseVariant as (typeof VARIANT_OPTIONS)[number]),
    );
  }, [exercise.exerciseVariant]);

  function handleEquipmentSelect(value: string) {
    if (value === OTHER_VALUE) {
      setOtherEquipment(true);
      onChange({ equipment: null });
      return;
    }
    setOtherEquipment(false);
    onChange({ equipment: value === NONE_VALUE ? null : value });
  }

  function handleVariantSelect(value: string) {
    if (value === OTHER_VALUE) {
      setOtherVariant(true);
      onChange({ exerciseVariant: null });
      return;
    }
    setOtherVariant(false);
    onChange({ exerciseVariant: value === NONE_VALUE ? null : value });
  }

  function handleMuscleGroupChange(group: string) {
    onChange({
      muscleGroup: group,
      exerciseName: "",
      exerciseCatalogId: null,
      equipment: null,
      isBodyweight: false,
    });
    setOtherMode(false);
  }

  function handleExerciseSelect(value: string) {
    if (value === OTHER_VALUE) {
      setOtherMode(true);
      onChange({ exerciseName: "", exerciseCatalogId: null });
      return;
    }
    const match = exercisesForGroup.find((item) => item.name === value);
    setOtherMode(false);
    onChange({
      exerciseName: value,
      equipment: match?.equipment ?? exercise.equipment,
      exerciseCatalogId: match?.id ?? null,
      isBodyweight: match?.is_bodyweight ?? false,
    });
  }

  function renumber(sets: WorkoutSetDraft[]): WorkoutSetDraft[] {
    return sets.map((set, i) => ({ ...set, setNumber: i + 1 }));
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
          <Label htmlFor={`muscle-group-${index}`} className="text-xs">
            Muscle group
          </Label>
          <Select value={exercise.muscleGroup} onValueChange={handleMuscleGroupChange}>
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

        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor={`exercise-name-${index}`} className="text-xs">
            Exercise
          </Label>
          <Select
            value={otherMode ? OTHER_VALUE : exercise.exerciseName || undefined}
            onValueChange={handleExerciseSelect}
          >
            <SelectTrigger id={`exercise-name-${index}`}>
              <SelectValue
                placeholder={
                  exercisesForGroup.length ? "Select an exercise" : "No presets — choose Other"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {exercisesForGroup.map((item) => (
                <SelectItem key={item.id} value={item.name}>
                  {item.name}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_VALUE}>Other (type your own)</SelectItem>
            </SelectContent>
          </Select>
          {otherMode ? (
            <Input
              className="mt-2"
              required
              placeholder="Name this exercise"
              value={exercise.exerciseName}
              onChange={(event) =>
                onChange({ exerciseName: event.target.value, exerciseCatalogId: null })
              }
            />
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`equipment-${index}`} className="text-xs">
            Equipment (optional)
          </Label>
          <Select
            value={otherEquipment ? OTHER_VALUE : exercise.equipment ?? undefined}
            onValueChange={handleEquipmentSelect}
          >
            <SelectTrigger id={`equipment-${index}`}>
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
              {EQUIPMENT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_VALUE}>Other (type your own)</SelectItem>
            </SelectContent>
          </Select>
          {otherEquipment ? (
            <Input
              className="mt-2"
              placeholder="Type the equipment"
              value={exercise.equipment ?? ""}
              onChange={(event) => onChange({ equipment: event.target.value || null })}
            />
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`variant-${index}`} className="text-xs">
            Variant (optional)
          </Label>
          <Select
            value={otherVariant ? OTHER_VALUE : exercise.exerciseVariant ?? undefined}
            onValueChange={handleVariantSelect}
          >
            <SelectTrigger id={`variant-${index}`}>
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
              {VARIANT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_VALUE}>Other (type your own)</SelectItem>
            </SelectContent>
          </Select>
          {otherVariant ? (
            <Input
              className="mt-2"
              placeholder="Type the variant"
              value={exercise.exerciseVariant ?? ""}
              onChange={(event) => onChange({ exerciseVariant: event.target.value || null })}
            />
          ) : null}
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
