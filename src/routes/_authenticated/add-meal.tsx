import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Camera, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
import {
  useCreateMeal,
  useMeal,
  useMealPhotoUrl,
  useRecentMeals,
  useUpdateMeal,
  type MealTemplate,
} from "@/lib/data";
import {
  analyzeMeal,
  parseServingToGrams,
  SERVING_SUGGESTIONS,
  type MacroEstimate,
} from "@/lib/food-estimate";
import { MEAL_CATEGORIES } from "@/lib/nutrition";

const searchSchema = z.object({ edit: z.string().optional() });

export const Route = createFileRoute("/_authenticated/add-meal")({
  validateSearch: searchSchema,
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
  component: AddMeal,
});

type MacroKey = "calories" | "protein_g" | "carbs_g" | "fat_g";

const NO_MACROS_TOUCHED: Record<MacroKey, boolean> = {
  calories: false,
  protein_g: false,
  carbs_g: false,
  fat_g: false,
};
const ALL_MACROS_TOUCHED: Record<MacroKey, boolean> = {
  calories: true,
  protein_g: true,
  carbs_g: true,
  fat_g: true,
};

function makeEmptyForm() {
  return {
    name: "",
    category: "lunch",
    serving_amount: "",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
    notes: "",
    eaten_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  };
}

function AddMeal() {
  const navigate = useNavigate();
  const { edit: editId } = Route.useSearch();
  const isEdit = !!editId;

  const create = useCreateMeal();
  const update = useUpdateMeal();
  const editingMeal = useMeal(editId ?? null);
  const recent = useRecentMeals();
  const fileInput = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const existingPhoto = useMealPhotoUrl(existingPhotoPath);
  const [estimate, setEstimate] = useState<MacroEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  // The edit id the form currently reflects — `undefined` until synced once.
  const [syncedId, setSyncedId] = useState<string | null | undefined>(undefined);
  // Which macro fields the user has typed into by hand. Auto-estimation never
  // overwrites these — only the manual "Re-estimate" button does.
  const [touched, setTouched] = useState<Record<MacroKey, boolean>>(NO_MACROS_TOUCHED);
  // When editing, the saved numbers stay put until the food name or serving is
  // changed — then the estimate takes over and re-adds every "+" item.
  const [descEdited, setDescEdited] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);

  function editDescription(patch: Partial<typeof form>) {
    setForm((s) => ({ ...s, ...patch }));
    if (isEdit && !descEdited) {
      // first change to the name/serving while editing — let the estimate take
      // over from the saved numbers.
      setDescEdited(true);
      setTouched(NO_MACROS_TOUCHED);
    }
  }

  const targetId = editId ?? null;
  const ready = syncedId === targetId;

  // Keep the form in sync with the route: load a meal when editing, or reset to
  // a blank form when switching back to "new". Runs when the target id changes.
  useEffect(() => {
    if (ready) return;
    if (isEdit) {
      if (!editingMeal.data) return; // wait for the meal to load
      const m = editingMeal.data;
      setForm({
        name: m.name,
        category: m.category,
        serving_amount: m.serving_amount ?? "",
        calories: String(m.calories ?? ""),
        protein_g: String(m.protein_g ?? ""),
        carbs_g: String(m.carbs_g ?? ""),
        fat_g: String(m.fat_g ?? ""),
        notes: m.notes ?? "",
        eaten_at: format(new Date(m.eaten_at), "yyyy-MM-dd'T'HH:mm"),
      });
      setExistingPhotoPath(m.photo_path);
    } else {
      setForm(makeEmptyForm());
      setExistingPhotoPath(null);
    }
    setTouched(NO_MACROS_TOUCHED);
    setDescEdited(false);
    setPhoto(null);
    setPhotoUrl(null);
    setEstimate(null);
    setSyncedId(targetId);
  }, [ready, isEdit, targetId, editingMeal.data]);

  function pickPhoto(file: File | null) {
    setPhoto(file);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
    if (file) setExistingPhotoPath(null);
  }

  function applyTemplate(t: MealTemplate) {
    setForm((s) => ({
      ...s,
      name: t.name,
      category: t.category,
      serving_amount: t.serving_amount ?? "",
      calories: String(t.calories),
      protein_g: String(t.protein_g),
      carbs_g: String(t.carbs_g),
      fat_g: String(t.fat_g),
    }));
    setTouched(ALL_MACROS_TOUCHED);
    setEstimate(null);
    toast.success(`Loaded "${t.name}" — edit anything before saving`);
  }

  // Auto-estimate: whenever there's a food name, fill calories/macros with an
  // approximate value. Debounced; fields edited by hand are left untouched.
  // When editing an existing meal it only kicks in once the name/serving is
  // actually changed, so opening an edit doesn't rewrite the saved numbers.
  useEffect(() => {
    if (!ready) return;
    if (isEdit && !descEdited) return;
    const description = form.name.trim();
    if (!description) return;

    const handle = window.setTimeout(async () => {
      setEstimating(true);
      try {
        const result = await analyzeMeal({
          description,
          grams: parseServingToGrams(form.serving_amount),
          photo,
        });
        if (!result) return;
        setEstimate(result);
        setForm((s) => ({
          ...s,
          calories: touched.calories ? s.calories : String(result.calories),
          protein_g: touched.protein_g ? s.protein_g : String(result.protein),
          carbs_g: touched.carbs_g ? s.carbs_g : String(result.carbs),
          fat_g: touched.fat_g ? s.fat_g : String(result.fat),
        }));
      } finally {
        setEstimating(false);
      }
    }, 600);

    return () => window.clearTimeout(handle);
  }, [form.name, form.serving_amount, photo, touched, ready, isEdit, descEdited]);

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
      // Manual re-estimate overrides everything, including hand-edited fields.
      setTouched(NO_MACROS_TOUCHED);
      setDescEdited(true);
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

    let { calories, protein_g, carbs_g, fat_g } = form;
    let usedEstimate = estimate;

    // Safety net: if every macro field is still empty at save time, estimate now
    // so a meal is never stored as 0 kcal / 0 g.
    if (!calories && !protein_g && !carbs_g && !fat_g) {
      try {
        const result = await analyzeMeal({
          description: form.name,
          grams: parseServingToGrams(form.serving_amount),
          photo,
        });
        if (result) {
          usedEstimate = result;
          calories = String(result.calories);
          protein_g = String(result.protein);
          carbs_g = String(result.carbs);
          fat_g = String(result.fat);
        }
      } catch {
        // fall through — save with whatever we have
      }
    }

    const fields = {
      name: form.name.trim(),
      category: form.category,
      serving_amount: form.serving_amount.trim() || null,
      calories: Number(calories || 0),
      protein_g: Number(protein_g || 0),
      carbs_g: Number(carbs_g || 0),
      fat_g: Number(fat_g || 0),
      notes: form.notes.trim() || null,
      eaten_at: new Date(form.eaten_at).toISOString(),
      is_estimate: usedEstimate !== null,
      estimate_source: usedEstimate?.source ?? null,
    };

    try {
      if (isEdit && editId) {
        await update.mutateAsync({ id: editId, ...fields, photo, photo_path: existingPhotoPath });
        toast.success("Meal updated");
      } else {
        await create.mutateAsync({ ...fields, photo });
        toast.success("Meal saved");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the meal");
    }
  }

  const macroFields: { key: MacroKey; label: string }[] = [
    { key: "calories", label: "Calories (kcal)" },
    { key: "protein_g", label: "Protein (g)" },
    { key: "carbs_g", label: "Carbs (g)" },
    { key: "fat_g", label: "Fat (g)" },
  ];

  const autoFilled = estimate !== null && !Object.values(touched).every(Boolean);
  const previewUrl = photoUrl ?? (existingPhotoPath ? existingPhoto.data ?? null : null);
  const saving = create.isPending || update.isPending;
  const recentMeals = recent.data ?? [];

  return (
    <AppShell
      title={isEdit ? "Edit Meal" : "Add Meal"}
      subtitle={isEdit ? "Update anything and save" : "Photo optional · every estimate stays editable"}
    >
      {!isEdit && recentMeals.length > 0 ? (
        <div className="panel mb-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Repeat a recent meal</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recentMeals.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTemplate(t)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-primary hover:bg-secondary"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {Math.round(t.calories)} kcal
                  {t.serving_amount ? ` · ${t.serving_amount}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
          {previewUrl ? (
            <div className="relative mt-3">
              <img src={previewUrl} alt="Selected meal" className="aspect-square w-full rounded-xl object-cover" />
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
            <Sparkles className="size-4" />{" "}
            {estimating ? "Estimating…" : estimate ? "Re-estimate calories & macros" : "Estimate calories & macros"}
          </Button>
          <p className="mt-3 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
            Calories and macros fill in <strong>automatically</strong> from your food name and serving size. They are{" "}
            <strong>approximate</strong>, not measured values — edit any number and your value is kept. Separate several
            foods with <strong>+</strong> and each is added up. Use <em>Re-estimate</em> to recalculate.
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
              placeholder="Grilled chicken breast + rice + salad"
              value={form.name}
              onChange={(e) => editDescription({ name: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              List everything you ate, separated by <strong>+</strong> — e.g. “2 eggs + toast + 1 apple”. Each item is
              estimated and added up.
            </p>
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
                onChange={(e) => editDescription({ serving_amount: e.target.value })}
              />
              <div className="flex flex-wrap gap-1">
                {SERVING_SUGGESTIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => editDescription({ serving_amount: v })}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      form.serving_amount === v
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Calories & macros
              </Label>
              {autoFilled ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Auto-estimated · editable
                </span>
              ) : null}
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
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((s) => ({ ...s, [f.key]: v }));
                      setTouched((t) => (t[f.key] ? t : { ...t, [f.key]: true }));
                    }}
                  />
                </div>
              ))}
            </div>
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
          <div className="flex gap-2">
            {isEdit ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate({ to: "/dashboard" })}
                className="shrink-0"
              >
                <RotateCcw className="size-4" /> Cancel
              </Button>
            ) : null}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update meal" : "Save meal"}
            </Button>
          </div>
        </section>
      </form>
    </AppShell>
  );
}
