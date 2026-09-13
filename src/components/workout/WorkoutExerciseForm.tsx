import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronsUpDown, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RecentExerciseName } from "@/lib/workouts/api";
import {
  getEquipmentOptionsFor,
  getVariantOptionsFor,
  MUSCLE_GROUPS,
} from "@/lib/workouts/constants";
import type {
  ExerciseCatalogItem,
  WorkoutExerciseDraft,
  WorkoutSetDraft,
} from "@/lib/workouts/types";
import { cn } from "@/lib/utils";

import { WorkoutSetEditor } from "./WorkoutSetEditor";

function makeSet(
  setNumber: number,
  isBodyweight: boolean,
  template?: WorkoutSetDraft,
): WorkoutSetDraft {
  return {
    setNumber,
    reps: template?.reps ?? 10,
    weightKg: template?.weightKg ?? null,
    weightMode: template?.weightMode ?? (isBodyweight ? "bodyweight" : "external"),
    rir: template?.rir ?? null,
    rpe: template?.rpe ?? null,
    completed: true,
    restSeconds: template?.restSeconds ?? 60,
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
    sets: [makeSet(1, false)],
  };
}

export function WorkoutExerciseForm({
  exercise,
  index,
  catalog,
  recentExerciseNames,
  onChange,
  onRemove,
  canRemove,
}: {
  exercise: WorkoutExerciseDraft;
  index: number;
  catalog: ExerciseCatalogItem[];
  /** The user's own recently-logged exercises — how a name typed under "Other"
   * becomes available again later, since the shared catalog table is read-only. */
  recentExerciseNames: RecentExerciseName[];
  onChange: (patch: Partial<WorkoutExerciseDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  // Which set is expanded — only ever one at a time, so the card stays
  // compact after "Add set" instead of growing a wall of open editors.
  // Starts on the first (only) set; a fresh "Add set" moves this to the new one.
  const [expandedSetIndex, setExpandedSetIndex] = useState(0);

  const exercisesForGroup = useMemo(
    () => catalog.filter((item) => item.muscle_group === exercise.muscleGroup),
    [catalog, exercise.muscleGroup],
  );

  // Recently-used names for this muscle group that aren't already a catalog
  // entry — this is what lets a name typed under "Other" show up again.
  const recentForGroup = useMemo(
    () =>
      recentExerciseNames.filter(
        (recent) =>
          recent.muscleGroup === exercise.muscleGroup &&
          !exercisesForGroup.some((item) => item.name.toLowerCase() === recent.name.toLowerCase()),
      ),
    [recentExerciseNames, exercisesForGroup, exercise.muscleGroup],
  );

  const knownNames = useMemo(
    () =>
      new Set([
        ...exercisesForGroup.map((item) => item.name.toLowerCase()),
        ...recentForGroup.map((recent) => recent.name.toLowerCase()),
      ]),
    [exercisesForGroup, recentForGroup],
  );

  const equipmentOptions = getEquipmentOptionsFor(exercise.exerciseName, exercise.isBodyweight);
  const variantOptions = getVariantOptionsFor(exercise.muscleGroup, exercise.exerciseName);
  const OTHER_EQUIPMENT = "__other_equipment__";
  const NONE_EQUIPMENT = "__none_equipment__";
  const OTHER_VARIANT = "__other_variant__";
  const NONE_VARIANT = "__none_variant__";
  const [otherEquipment, setOtherEquipment] = useState(
    () => !!exercise.equipment && !equipmentOptions.includes(exercise.equipment),
  );
  const [otherVariant, setOtherVariant] = useState(
    () => !!exercise.exerciseVariant && !variantOptions.includes(exercise.exerciseVariant),
  );

  function selectExercise(
    name: string,
    opts?: {
      equipment?: string | null;
      variant?: string | null;
      catalogId?: string | null;
      isBodyweight?: boolean;
    },
  ) {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange({
      exerciseName: trimmed,
      exerciseCatalogId: opts?.catalogId ?? null,
      equipment: opts?.equipment ?? null,
      exerciseVariant: opts?.variant ?? null,
      isBodyweight: opts?.isBodyweight ?? false,
    });
    setOtherEquipment(false);
    setOtherVariant(false);
    setExercisePickerOpen(false);
    setExerciseQuery("");
  }

  function handleEquipmentSelect(value: string) {
    if (value === OTHER_EQUIPMENT) {
      setOtherEquipment(true);
      onChange({ equipment: null });
      return;
    }
    setOtherEquipment(false);
    onChange({ equipment: value === NONE_EQUIPMENT ? null : value });
  }

  function handleVariantSelect(value: string) {
    if (value === OTHER_VARIANT) {
      setOtherVariant(true);
      onChange({ exerciseVariant: null });
      return;
    }
    setOtherVariant(false);
    onChange({ exerciseVariant: value === NONE_VARIANT ? null : value });
  }

  function handleMuscleGroupChange(group: string) {
    onChange({
      muscleGroup: group,
      exerciseName: "",
      exerciseCatalogId: null,
      equipment: null,
      exerciseVariant: null,
      isBodyweight: false,
    });
    setOtherEquipment(false);
    setOtherVariant(false);
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
    const nextIndex = exercise.sets.length;
    onChange({ sets: [...exercise.sets, makeSet(nextIndex + 1, exercise.isBodyweight, last)] });
    setExpandedSetIndex(nextIndex);
  }

  function removeSet(setIndex: number) {
    if (exercise.sets.length <= 1) return;
    onChange({ sets: renumber(exercise.sets.filter((_, i) => i !== setIndex)) });
    setExpandedSetIndex((current) => (current >= setIndex ? Math.max(0, current - 1) : current));
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
          <Popover open={exercisePickerOpen} onOpenChange={setExercisePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                id={`exercise-name-${index}`}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={exercisePickerOpen}
                className="w-full justify-between font-normal"
              >
                <span className={cn("truncate", !exercise.exerciseName && "text-muted-foreground")}>
                  {exercise.exerciseName || "Search or type an exercise"}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search or type a new exercise…"
                  value={exerciseQuery}
                  onValueChange={setExerciseQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    {exerciseQuery.trim() ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => selectExercise(exerciseQuery)}
                      >
                        <Plus className="size-4" /> Use &ldquo;{exerciseQuery.trim()}&rdquo;
                      </button>
                    ) : (
                      "No exercises yet — type to add one"
                    )}
                  </CommandEmpty>
                  {exercisesForGroup.length > 0 ? (
                    <CommandGroup heading="Exercises">
                      {exercisesForGroup.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={item.name}
                          onSelect={() =>
                            selectExercise(item.name, {
                              equipment: item.equipment,
                              variant: item.variant,
                              catalogId: item.id,
                              isBodyweight: item.is_bodyweight,
                            })
                          }
                        >
                          <Check
                            className={cn(
                              "size-4",
                              exercise.exerciseName === item.name ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {item.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {recentForGroup.length > 0 ? (
                    <CommandGroup heading="Recently used">
                      {recentForGroup.map((recent) => (
                        <CommandItem
                          key={recent.name}
                          value={recent.name}
                          onSelect={() =>
                            selectExercise(recent.name, {
                              equipment: recent.equipment,
                              variant: recent.exerciseVariant,
                            })
                          }
                        >
                          <Check
                            className={cn(
                              "size-4",
                              exercise.exerciseName === recent.name ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {recent.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {exerciseQuery.trim() && !knownNames.has(exerciseQuery.trim().toLowerCase()) ? (
                    <CommandGroup>
                      <CommandItem
                        value={`__create__${exerciseQuery}`}
                        onSelect={() => selectExercise(exerciseQuery)}
                      >
                        <Plus className="size-4" /> Use &ldquo;{exerciseQuery.trim()}&rdquo;
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`equipment-${index}`} className="text-xs">
            Equipment (optional)
          </Label>
          <Select
            {...(otherEquipment || exercise.equipment
              ? { value: otherEquipment ? OTHER_EQUIPMENT : (exercise.equipment as string) }
              : {})}
            onValueChange={handleEquipmentSelect}
          >
            <SelectTrigger id={`equipment-${index}`}>
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_EQUIPMENT}>Not specified</SelectItem>
              {equipmentOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_EQUIPMENT}>Other (type your own)</SelectItem>
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
            {...(otherVariant || exercise.exerciseVariant
              ? { value: otherVariant ? OTHER_VARIANT : (exercise.exerciseVariant as string) }
              : {})}
            onValueChange={handleVariantSelect}
          >
            <SelectTrigger id={`variant-${index}`}>
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VARIANT}>Not specified</SelectItem>
              {variantOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_VARIANT}>Other (type your own)</SelectItem>
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
        {exercise.sets.map((set, setIndex) =>
          setIndex === expandedSetIndex ? (
            <WorkoutSetEditor
              key={setIndex}
              set={set}
              isBodyweight={exercise.isBodyweight}
              canRemove={exercise.sets.length > 1}
              onChange={(patch) => updateSet(setIndex, patch)}
              onRemove={() => removeSet(setIndex)}
            />
          ) : (
            <button
              key={setIndex}
              type="button"
              onClick={() => setExpandedSetIndex(setIndex)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-left text-xs hover:border-primary"
            >
              <span className="font-medium text-muted-foreground">
                Set {set.setNumber} · {set.reps} reps
                {set.weightKg !== null ? ` · ${set.weightKg} kg` : ""}
                {set.restSeconds !== null ? ` · ${set.restSeconds}s rest` : ""}
              </span>
              <ChevronDown
                className="size-3.5 -rotate-90 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          ),
        )}
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={addSet}>
        <Plus className="size-4" /> Add set
      </Button>
    </div>
  );
}
