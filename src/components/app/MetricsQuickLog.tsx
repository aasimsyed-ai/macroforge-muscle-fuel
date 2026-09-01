import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSaveMetric, type DailyMetric, type Goals } from "@/lib/data";

type Props = { today: DailyMetric | undefined; goals: Goals };

export function MetricsQuickLog({ today, goals }: Props) {
  const save = useSaveMetric();
  const date = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({
    weight_kg: "",
    waist_cm: "",
    water_ml: "",
    sleep_hours: "",
    workout_minutes: "",
    workout_type: "",
    creatine_taken: false,
  });

  useEffect(() => {
    setForm({
      weight_kg: today?.weight_kg?.toString() ?? "",
      waist_cm: today?.waist_cm?.toString() ?? "",
      water_ml: today?.water_ml?.toString() ?? "",
      sleep_hours: today?.sleep_hours?.toString() ?? "",
      workout_minutes: today?.workout_minutes?.toString() ?? "",
      workout_type: today?.workout_type ?? "",
      creatine_taken: today?.creatine_taken ?? false,
    });
  }, [today]);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        metric_date: date,
        weight_kg: num(form.weight_kg),
        waist_cm: num(form.waist_cm),
        water_ml: num(form.water_ml),
        sleep_hours: num(form.sleep_hours),
        workout_minutes: num(form.workout_minutes),
        workout_type: form.workout_type.trim() || null,
        creatine_taken: form.creatine_taken,
        creatine_g: form.creatine_taken ? goals.creatine_target_g : 0,
      });
      toast.success("Today's metrics saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save metrics");
    }
  }

  const fields: { key: keyof typeof form; label: string; step?: string; placeholder?: string }[] = [
    { key: "weight_kg", label: "Weight (kg)", step: "0.1", placeholder: "64" },
    { key: "waist_cm", label: "Waist (cm)", step: "0.1", placeholder: "78" },
    { key: "water_ml", label: `Water (ml of ${goals.water_target_ml})`, step: "50", placeholder: "3000" },
    { key: "sleep_hours", label: `Sleep (h of ${goals.sleep_target_hours})`, step: "0.1", placeholder: "7.5" },
    { key: "workout_minutes", label: "Workout (min)", step: "5", placeholder: "60" },
  ];

  return (
    <form onSubmit={submit} className="panel space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold">Today&apos;s body & habits</p>
        <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE d MMM yyyy")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key} className="text-xs">
              {f.label}
            </Label>
            <Input
              id={f.key}
              type="number"
              inputMode="decimal"
              step={f.step}
              min="0"
              placeholder={f.placeholder}
              value={form[f.key] as string}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="workout_type" className="text-xs">
            Workout type
          </Label>
          <Input
            id="workout_type"
            placeholder="Push / Pull / Legs"
            value={form.workout_type}
            onChange={(e) => setForm((s) => ({ ...s, workout_type: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
        <Label htmlFor="creatine" className="text-sm">
          Creatine taken ({goals.creatine_target_g} g)
        </Label>
        <Switch
          id="creatine"
          checked={form.creatine_taken}
          onCheckedChange={(v) => setForm((s) => ({ ...s, creatine_taken: v }))}
        />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full sm:w-auto">
        {save.isPending ? "Saving…" : "Save today's metrics"}
      </Button>
    </form>
  );
}
