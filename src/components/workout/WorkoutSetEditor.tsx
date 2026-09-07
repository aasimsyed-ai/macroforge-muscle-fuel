import { useState } from "react";
import { X } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { INDIAN_GYM_WEIGHTS_KG, WEIGHT_MODES } from "@/lib/workouts/constants";
import type { WeightMode, WorkoutSetDraft } from "@/lib/workouts/types";

const LADDER = INDIAN_GYM_WEIGHTS_KG as readonly number[];

function isPresetWeight(value: number | null): boolean {
  return value !== null && LADDER.includes(value);
}

function toNumberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function WorkoutSetEditor({
  set,
  onChange,
  onRemove,
  canRemove,
}: {
  set: WorkoutSetDraft;
  onChange: (patch: Partial<WorkoutSetDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [customWeight, setCustomWeight] = useState(
    () => set.weightMode !== "bodyweight" && set.weightKg !== null && !isPresetWeight(set.weightKg),
  );

  const isBodyweight = set.weightMode === "bodyweight";

  function changeMode(nextMode: WeightMode) {
    if (nextMode === "bodyweight") {
      setCustomWeight(false);
      onChange({ weightMode: nextMode, weightKg: null });
    } else {
      onChange({ weightMode: nextMode });
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Set {set.setNumber}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Remove set ${set.setNumber}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`reps-${set.setNumber}`} className="text-[11px]">
            Reps
          </Label>
          <Input
            id={`reps-${set.setNumber}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={set.reps === 0 ? "" : String(set.reps)}
            onChange={(event) => onChange({ reps: Math.trunc(Number(event.target.value) || 0) })}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`mode-${set.setNumber}`} className="text-[11px]">
            Load
          </Label>
          <Select value={set.weightMode} onValueChange={(value) => changeMode(value as WeightMode)}>
            <SelectTrigger id={`mode-${set.setNumber}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEIGHT_MODES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-1">
          <Label htmlFor={`weight-${set.setNumber}`} className="text-[11px]">
            {isBodyweight ? "Added weight (kg, optional)" : "Weight (kg)"}
          </Label>
          {isBodyweight || customWeight ? (
            <Input
              id={`weight-${set.setNumber}`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              placeholder={isBodyweight ? "0" : "e.g. 42.5"}
              value={set.weightKg === null ? "" : String(set.weightKg)}
              onChange={(event) => onChange({ weightKg: toNumberOrNull(event.target.value) })}
            />
          ) : (
            <Select
              value={set.weightKg === null ? "" : String(set.weightKg)}
              onValueChange={(value) => {
                if (value === "__custom__") {
                  setCustomWeight(true);
                  return;
                }
                onChange({ weightKg: Number(value) });
              }}
            >
              <SelectTrigger id={`weight-${set.setNumber}`}>
                <SelectValue placeholder="Select weight" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_GYM_WEIGHTS_KG.map((weight) => (
                  <SelectItem key={weight} value={String(weight)}>
                    {weight} kg
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">Custom…</SelectItem>
              </SelectContent>
            </Select>
          )}
          {!isBodyweight && customWeight ? (
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={() => setCustomWeight(false)}
            >
              Use preset weights
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`rir-${set.setNumber}`} className="text-[11px]">
            RIR (0-10)
          </Label>
          <Input
            id={`rir-${set.setNumber}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={10}
            step="0.5"
            value={set.rir === null ? "" : String(set.rir)}
            onChange={(event) => onChange({ rir: toNumberOrNull(event.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rpe-${set.setNumber}`} className="text-[11px]">
            RPE (1-10)
          </Label>
          <Input
            id={`rpe-${set.setNumber}`}
            type="number"
            inputMode="decimal"
            min={1}
            max={10}
            step="0.5"
            value={set.rpe === null ? "" : String(set.rpe)}
            onChange={(event) => onChange({ rpe: toNumberOrNull(event.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rest-${set.setNumber}`} className="text-[11px]">
            Rest (sec)
          </Label>
          <Input
            id={`rest-${set.setNumber}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={3600}
            step="15"
            value={set.restSeconds === null ? "" : String(set.restSeconds)}
            onChange={(event) => onChange({ restSeconds: toNumberOrNull(event.target.value) })}
          />
        </div>
        <div className="flex items-end justify-between gap-2 rounded-md bg-secondary px-2 py-1.5">
          <Label htmlFor={`done-${set.setNumber}`} className="text-[11px]">
            Completed
          </Label>
          <Switch
            id={`done-${set.setNumber}`}
            checked={set.completed}
            onCheckedChange={(checked) => onChange({ completed: checked })}
          />
        </div>
      </div>
    </div>
  );
}
