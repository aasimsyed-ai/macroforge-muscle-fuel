import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
  useSaveTrainingPreferences,
  useTrainingPreferences,
} from "@/lib/workouts/hooks";

export function NotificationPreferences() {
  const notif = useNotificationPreferences();
  const saveNotif = useSaveNotificationPreferences();
  const training = useTrainingPreferences();
  const saveTraining = useSaveTrainingPreferences();

  const [form, setForm] = useState({
    enableProgression: true,
    enableMotivation: true,
    enableHealth: true,
    quietStart: "",
    quietEnd: "",
    targetMinReps: "8",
    targetMaxReps: "12",
    targetSets: "3",
  });

  useEffect(() => {
    const data = notif.data;
    if (!data) return;
    setForm((current) => ({
      ...current,
      enableProgression: data.enableProgression,
      enableMotivation: data.enableMotivation,
      enableHealth: data.enableHealth,
      quietStart: data.quietHoursStart?.slice(0, 5) ?? "",
      quietEnd: data.quietHoursEnd?.slice(0, 5) ?? "",
    }));
  }, [notif.data]);

  useEffect(() => {
    const data = training.data;
    if (!data) return;
    setForm((current) => ({
      ...current,
      targetMinReps: String(data.targetMinReps),
      targetMaxReps: String(data.targetMaxReps),
      targetSets: String(data.targetSets),
    }));
  }, [training.data]);

  async function save() {
    try {
      await saveNotif.mutateAsync({
        enableProgression: form.enableProgression,
        enableMotivation: form.enableMotivation,
        enableHealth: form.enableHealth,
        quietHoursStart: form.quietStart ? `${form.quietStart}:00` : null,
        quietHoursEnd: form.quietEnd ? `${form.quietEnd}:00` : null,
      });
      const min = Math.max(1, Math.trunc(Number(form.targetMinReps) || 8));
      const max = Math.max(min, Math.trunc(Number(form.targetMaxReps) || 12));
      await saveTraining.mutateAsync({
        targetMinReps: min,
        targetMaxReps: max,
        targetSets: Math.max(1, Math.trunc(Number(form.targetSets) || 3)),
      });
      toast.success("Preferences saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preferences");
    }
  }

  const toggles: { key: "enableProgression" | "enableMotivation" | "enableHealth"; label: string }[] =
    [
      { key: "enableProgression", label: "Progression & guidance" },
      { key: "enableMotivation", label: "Motivation & consistency" },
      { key: "enableHealth", label: "Recovery & health awareness" },
    ];

  return (
    <div className="panel space-y-4 p-4">
      <p className="text-sm font-semibold">Insight & notification preferences</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="target-min-reps" className="text-xs">
            Target reps (min)
          </Label>
          <Input
            id="target-min-reps"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.targetMinReps}
            onChange={(event) => setForm((c) => ({ ...c, targetMinReps: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="target-max-reps" className="text-xs">
            Target reps (max)
          </Label>
          <Input
            id="target-max-reps"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.targetMaxReps}
            onChange={(event) => setForm((c) => ({ ...c, targetMaxReps: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="target-sets" className="text-xs">
            Working sets
          </Label>
          <Input
            id="target-sets"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.targetSets}
            onChange={(event) => setForm((c) => ({ ...c, targetSets: event.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        {toggles.map((toggle) => (
          <div
            key={toggle.key}
            className="flex items-center justify-between rounded-md bg-secondary px-3 py-2"
          >
            <Label htmlFor={toggle.key} className="text-sm">
              {toggle.label}
            </Label>
            <Switch
              id={toggle.key}
              checked={form[toggle.key]}
              onCheckedChange={(checked) => setForm((c) => ({ ...c, [toggle.key]: checked }))}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="quiet-start" className="text-xs">
            Quiet hours start
          </Label>
          <Input
            id="quiet-start"
            type="time"
            value={form.quietStart}
            onChange={(event) => setForm((c) => ({ ...c, quietStart: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quiet-end" className="text-xs">
            Quiet hours end
          </Label>
          <Input
            id="quiet-end"
            type="time"
            value={form.quietEnd}
            onChange={(event) => setForm((c) => ({ ...c, quietEnd: event.target.value }))}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        During quiet hours only critical alerts are shown. Guidance is limited to one item per
        category per day and five non-system items per week.
      </p>

      <Button
        type="button"
        onClick={save}
        disabled={saveNotif.isPending || saveTraining.isPending}
        className="w-full sm:w-auto"
      >
        {saveNotif.isPending || saveTraining.isPending ? "Saving…" : "Save preferences"}
      </Button>
    </div>
  );
}
