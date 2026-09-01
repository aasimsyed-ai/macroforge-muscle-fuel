import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Camera, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
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
import { useCreateMeal } from "@/lib/data";
import { analyzeMeal, parseServingToGrams, type MacroEstimate } from "@/lib/food-estimate";
import { MEAL_CATEGORIES } from "@/lib/nutrition";

export const Route = createFileRoute("/_authenticated/add-meal")({
  head: () => ({
    meta: [
      { title: "Add Meal — MacroForge" },
      {
        name: "description",
        content: "Log a meal with an optional photo, get an approximate macro estimate and correct it before saving.",
      },
      { property: "og:title", content: "Add Meal — MacroForge" },
      { property: "og:description", content: "Photo-assisted meal logging with editable macro estimates." },
    ],
  }),
  component: AddMeal;
});

function AddMeal() {
  const navigate = useNavigate();
  const create = useCreateMeal();
  const fileInput = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<MacroEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "lunch",
    serving_amount: "",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
    notes: "",
    eaten_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  function pickPhoto(file: File | null) {
    setPhoto(file);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
  }

  async function estimateMacros() {
    if (!form.name.trim() && !photo) {
      toast.error("Add a food name (or a photo plus a name) to estimate macros.");
      return;
    }
    setEstimating(true);
    try {
      const result = await analyzeMeal({
        description: form.name,
        grams: parseServingToGrams(form.serving_amount),
        photo,
      });
      if (!result) {
        toast.error("Could not estimate this meal — enter the numbers manually.");
        return;
      }
      setEstimate(result);
      setForm((s) => ({
        ...s,
        calories: String(result.calories),
        protein_g: String(result.protein),
        carbs_g: String(result.carbs),
        fat_g: String(result.fat),
      }));
      toast.success("Approximate estimate filled in — please correct it if needed.");
    } finally {
      setEstimating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Give the meal a name.");
      return;
    }
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        category: form.category,
        serving_amount: form.serving_amount.trim() || null,
        calories: Number(form.calories || 0),
        protein_g: Number(form.protein_g || 0),
        carbs_g: Number(form.carbs_g || 0),
        fat_g: Number(form.fat_g || 0),
        notes: form.notes.trim() || null,
        eaten_at: new Date(form.eaten_at).toISOString(),
        is_estimate: estimate !== null,
        estimate_source: estimate?.source ?? null,
        photo,
      });
      toast.success("Meal saved");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the meal");
    }
  }

  const macroFields: { key: "calories" | "protein_g" | "carbs_g" | "fat_g"; label: string }[] = [
    { key: "calories", label: "Calories (kcal)" },
    { key: "protein_g", label: "Protein (g)" },
    { key: "carbs_g", label: "Carbs (g)" },
    { key: "fat_g", label: "Fat (g)" },
  ];

  return (
    <AppShell title="Add Meal" subtitle="Photo optional · every estimate stays editable">
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="panel p-4">
          <p className="text-sm font-semibold">Meal photo</p>
          <p className="text-xs text-muted-foreground">
            Attach or take a photo of your plate. Photos are stored privately to your account.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
          />
          {photoUrl ? (
            <div className="relative mt-3">
              <img src={photoUrl} alt="Selected meal" className="aspect-square w-full rounded-xl object-cover" />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2"
                aria-label="Remove photo"
                onClick={() => pickPhoto(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-3 flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Camera className="size-7 text-primary" aria-hidden="true" />
              Take or upload a food photo
            </button>
          )}
          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={estimateMacros} disabled={estimating}>
            <Sparkles className="size-4" /> {estimating ? "Estimating…" : "Estimate calories & macros"}
          </Button>
          <p className="mt-3 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
            Estimates are <strong>approximate</strong>, not measured values. They come from a reference food table using
            your description and serving size — a photo alone cannot know your portion. Always check the numbers before
            saving.
          </p>
          {estimate ? (
            <p className="mt-2 text-xs text-primary">
              {estimate.note} (confidence ≈ {Math.round(estimate.confidence * 100)}%)
            </p>
          ) : null}
        </section>

        <section className="panel space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="name">Food name</Label>
            <Input
              id="name"
              required
              placeholder="Grilled chicken breast with rice"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((s) => ({ ...s, category: v }))}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serving">Serving amount</Label>
              <Input
                id="serving"
                placeholder="200 g / 1 bowl / 2 rotis"
                value={form.serving_amount}
                onChange={(e) => setForm((s) => ({ ...s, serving_amount: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {macroFields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key} className="text-xs">
                  {f.label}
                </Label>
                <Input
                  id={f.key}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="eaten_at">Date & time</Label>
            <Input
              id="eaten_at"
              type="datetime-local"
              value={form.eaten_at}
              onChange={(e) => setForm((s) => ({ ...s, eaten_at: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Post-workout, extra whey scoop…"
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save meal"}
          </Button>
        </section>
      </form>
    </AppShell>
  );
}
