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
import { INDIAN_GYM_WEIGHTS_KG } from "@/lib/workouts/constants";
import type { WorkoutSetDraft } from "@/lib/workouts/types";

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
  isBodyweight,
  onChange,
  onRemove,
  canRemove,
}: {
  set: WorkoutSetDraft;
  /** From the exercise (catalog match or manual pick) — decides whether this
   * set tracks bodyweight + optional added load, or a plain external weight.
   * No longer a per-set user choice (the "Load" mode picker was removed from
   * the entry UI); the underlying `weightMode` is still stored for volume
   * calculations, just set automatically to match. */
  isBodyweight: boolean;
  onChange: (patch: Partial<WorkoutSetDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [customWeight, setCustomWeight] = useState(
    () => !isBodyweight && set.weightKg !== null && !isPresetWeight(set.weightKg),
  );

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

        <div className="col-span-1 space-y-1 sm:col-span-2">
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
