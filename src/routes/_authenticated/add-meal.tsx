import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  AlertCircle,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Mic,
  MicOff,
  RotateCcw,
  ScanLine,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app/AppShell";
import { SectionGuide } from "@/components/app/SectionGuide";
import {
  BarcodeScannerDialog,
  isBarcodeScanningSupported,
} from "@/components/app/BarcodeScannerDialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateMeal,
  useDeleteMealTemplate,
  useFrequentFoods,
  useMeal,
  useMealPhotoUrl,
  useRecentMeals,
  useSaveMealTemplate,
  useSavedMeals,
  useUpdateMeal,
  type FrequentFood,
  type MealTemplate,
} from "@/lib/data";
import {
  analyzeMeal,
  parseServingToGrams,
  provenanceLabel,
  SERVING_SUGGESTIONS,
  type EstimatedItem,
  type MacroEstimate,
} from "@/lib/food-estimate";
import { validateItem } from "@/lib/food/validate";
import { playSaveTone, triggerHaptic } from "@/lib/celebrationEffects";
import { MEAL_CATEGORIES, round } from "@/lib/nutrition";
import { useSaveFeedback } from "@/lib/useSaveFeedback";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

const searchSchema = z.object({ edit: z.string().optional() });

export const Route = createFileRoute("/_authenticated/add-meal")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Add Meal — MacroForge" },
      {
        name: "description",
        content:
          "Log a meal with an optional photo, get an approximate macro estimate and correct it before saving.",
      },
      { property: "og:title", content: "Add Meal — MacroForge" },
      {
        property: "og:description",
        content: "Photo-assisted meal logging with editable macro estimates.",
      },
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

function QuickAddChip({
  meal,
  onClick,
  onDelete,
}: {
  meal: MealTemplate;
  onClick: () => void;
  /** Only saved (user-curated) meals are deletable — recent/frequent chips are derived, not owned. */
  onDelete?: () => void;
}) {
  return (
    <span className="inline-flex items-center overflow-hidden rounded-full border border-border bg-card transition-colors hover:border-primary hover:bg-secondary">
      <button type="button" onClick={onClick} className="px-3 py-1.5 text-left text-xs">
        <span className="font-medium">{meal.name}</span>
        <span className="text-muted-foreground">
          {" · "}
          {Math.round(meal.calories)} kcal
          {meal.serving_amount ? ` · ${meal.serving_amount}` : ""}
        </span>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove saved meal ${meal.name}`}
          className="pr-2.5 text-muted-foreground hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * A single food (not a whole meal) — no macros shown, since tapping it fills
 * the Food-name field and lets the normal auto-estimate produce fresh
 * numbers, rather than replaying one past meal's combined totals.
 */
function FrequentFoodChip({ food, onClick }: { food: FrequentFood; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs capitalize transition-colors hover:border-primary hover:bg-secondary"
    >
      <span className="font-medium">{food.name}</span>
      <span className="text-muted-foreground"> · logged {food.count}×</span>
    </button>
  );
}

/**
 * Where an item's numbers came from: a provenance badge, any warnings (always
 * visible), and the source + assumptions behind them (one tap away).
 */
function ItemDetails({ item, className = "" }: { item: EstimatedItem; className?: string }) {
  const provenance = item.edited ? "user" : item.provenance;
  const flags = item.flags ?? [];
  const assumptions = item.assumptions ?? [];
  if (!provenance && flags.length === 0) return null;
  return (
    <div className={`space-y-1 text-[10px] text-muted-foreground ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {provenance ? (
          <span
            className={`rounded-full border px-1.5 py-0.5 font-medium ${
              provenance === "none" ? "border-destructive/50 text-destructive" : "border-border"
            }`}
          >
            {provenanceLabel(provenance)}
          </span>
        ) : null}
        {item.confidence != null && provenance !== "none" && provenance !== "user" ? (
          <span>confidence ≈ {Math.round(item.confidence * 100)}%</span>
        ) : null}
      </div>
      {flags.map((flag) => (
        <p
          key={flag.code}
          className={`flex items-start gap-1 ${
            flag.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-300"
          }`}
        >
          <AlertCircle className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span>{flag.message}</span>
        </p>
      ))}
      {item.sourceNote || assumptions.length > 0 ? (
        <details>
          <summary className="cursor-pointer select-none">Where these numbers come from</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {item.sourceNote ? <li>{item.sourceNote}</li> : null}
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** One row of the itemized review list — shown when a meal has several foods, or one that needs attention. */
function ItemRow({
  item,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
}: {
  item: EstimatedItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<EstimatedItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md bg-secondary/60 p-2 text-xs">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="shrink-0 text-muted-foreground"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} carbs and fat for ${item.label}`}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <Input
            value={item.label}
            onChange={(e) => onChange({ label: e.target.value })}
            aria-label="Food name"
            className="h-6 w-full border-none bg-transparent px-1 font-medium shadow-none focus-visible:ring-1"
          />
          {item.grams != null || item.exact ? (
            <span className="block px-1 text-[10px] text-muted-foreground">
              {item.exact
                ? `from label${item.grams != null ? ` · ${item.grams} g` : ""}`
                : `~${item.grams} g`}
            </span>
          ) : null}
        </div>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={item.calories}
          onChange={(e) => onChange({ calories: Number(e.target.value) || 0 })}
          aria-label={`${item.label} calories`}
          className="h-7 w-16 shrink-0 px-1.5 text-right text-xs"
        />
        <span className="shrink-0 text-[10px] text-muted-foreground">kcal</span>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          value={item.protein}
          onChange={(e) => onChange({ protein: Number(e.target.value) || 0 })}
          aria-label={`${item.label} protein`}
          className="h-7 w-14 shrink-0 px-1.5 text-right text-xs"
        />
        <span className="shrink-0 text-[10px] text-muted-foreground">g P</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label={`Remove ${item.label}`}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {expanded ? (
        <div className="mt-2 grid grid-cols-2 gap-2 pl-5">
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground">Carbs (g)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={item.carbs}
              onChange={(e) => onChange({ carbs: Number(e.target.value) || 0 })}
              aria-label={`${item.label} carbs`}
              className="h-7 flex-1 px-1.5 text-right text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground">Fat (g)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={item.fat}
              onChange={(e) => onChange({ fat: Number(e.target.value) || 0 })}
              aria-label={`${item.label} fat`}
              className="h-7 flex-1 px-1.5 text-right text-xs"
            />
          </div>
        </div>
      ) : null}
      <ItemDetails item={item} className="mt-1.5 pl-5" />
    </div>
  );
}

function AddMeal() {
  const navigate = useNavigate();
  const { edit: editId } = Route.useSearch();
  const isEdit = !!editId;

  const create = useCreateMeal();
  const update = useUpdateMeal();
  const editingMeal = useMeal(editId ?? null);
  const recent = useRecentMeals();
  const [quickAddTab, setQuickAddTab] = useState<"recent" | "frequent" | "saved">("recent");
  const frequent = useFrequentFoods(8, { enabled: quickAddTab === "frequent" });
  // Unlike Frequent (an expensive 300-row scan + computation, worth deferring
  // until asked for), Saved is a lean, user-owned table — fetched whenever
  // this isn't an edit so the quick-add panel's visibility (which checks
  // savedMeals.length) reflects reality even when the user has no recent
  // meals yet but does have saved templates, instead of always reading as
  // empty until they've already found the "saved" tab.
  const saved = useSavedMeals({ enabled: !isEdit });
  const saveMealTemplate = useSaveMealTemplate();
  const deleteMealTemplate = useDeleteMealTemplate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [justSaved, celebrate] = useSaveFeedback();

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const existingPhoto = useMealPhotoUrl(existingPhotoPath);
  const [estimate, setEstimate] = useState<MacroEstimate | null>(null);
  // Provenance of numbers replayed from a Recent/Saved meal — they were an
  // estimate when first logged and must not be re-labelled as exact on reuse.
  const [carried, setCarried] = useState<{
    is_estimate: boolean;
    estimate_source: string | null;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);
  // Per-item breakdown of the current estimate, editable before saving. Only
  // shown when there's more than one recognised food (see render below).
  const [items, setItems] = useState<EstimatedItem[]>([]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  // The edit id the form currently reflects — `undefined` until synced once.
  const [syncedId, setSyncedId] = useState<string | null | undefined>(undefined);
  // Which macro fields the user has typed into by hand. Auto-estimation never
  // overwrites these — only the manual "Re-estimate" button does.
  const [touched, setTouched] = useState<Record<MacroKey, boolean>>(NO_MACROS_TOUCHED);
  // Read inside the debounced auto-estimate effect instead of depending on
  // `touched` directly — depending on it would restart the debounce timer
  // (and re-run analyzeMeal) on every hand-edit of a macro field, which would
  // also clobber any itemized-list edits made in between.
  const touchedRef = useRef(touched);
  useEffect(() => {
    touchedRef.current = touched;
  }, [touched]);
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

  // Voice logging: appends the transcript to whatever's already in the
  // Food-name field (mirroring how a barcode scan appends, rather than
  // replacing what the user typed or scanned before tapping the mic), so the
  // existing auto-estimate effect below picks it up for free — no separate
  // estimation path needed. Free, on-device, no server call; simply hidden
  // on browsers without native speech recognition (notably iOS Safari), same
  // graceful-degradation approach as every other best-effort feature in this
  // app.
  const speech = useSpeechRecognition(
    (transcript) =>
      editDescription({
        name: form.name.trim() ? `${form.name.trim()} + ${transcript}` : transcript,
      }),
    (reason) =>
      toast.error(
        reason === "not-allowed"
          ? "Microphone access was denied — check your browser's site permissions."
          : reason === "no-speech"
            ? "Didn't catch that — try again."
            : "Voice input failed — you can still type the food name.",
      ),
  );

  // Barcode scanning: feature-detected once (BarcodeDetector isn't in Safari/
  // iOS/Firefox) rather than on every render.
  const [barcodeSupported] = useState(isBarcodeScanningSupported);
  const [scannerOpen, setScannerOpen] = useState(false);

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
    setCarried(null);
    setItems([]);
    setExpandedItem(null);
    setSyncedId(targetId);
  }, [ready, isEdit, targetId, editingMeal.data]);

  function pickPhoto(file: File | null) {
    setPhoto(file);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
    if (file) {
      setExistingPhotoPath(null);
      if (isEdit && !descEdited) {
        setDescEdited(true);
        setTouched(NO_MACROS_TOUCHED);
      }
    }
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
    setCarried({ is_estimate: t.is_estimate, estimate_source: t.estimate_source });
    setItems([]);
    setExpandedItem(null);
    toast.success(`Loaded "${t.name}" — edit anything before saving`);
  }

  // A frequent food isn't a saved meal with known macros — it's just a name.
  // Put it in the Food-name field exactly as if the user had typed it, so the
  // normal auto-estimate below produces a fresh estimate rather than
  // replaying one past meal's combined totals.
  function applyFrequentFood(food: FrequentFood) {
    editDescription({ name: food.name });
  }

  // Saves the form's current values as a reusable template, under the food
  // name already typed — no separate naming step, so it stays one tap from
  // an already-filled form. Saving again under the same name replaces it.
  async function saveAsTemplate() {
    if (!form.name.trim()) {
      toast.error("Add a food name first.");
      return;
    }
    try {
      await saveMealTemplate.mutateAsync({
        name: form.name.trim(),
        category: form.category,
        serving_amount: form.serving_amount.trim() || null,
        calories: Number(form.calories || 0),
        protein_g: Number(form.protein_g || 0),
        carbs_g: Number(form.carbs_g || 0),
        fat_g: Number(form.fat_g || 0),
        is_estimate: estimate !== null || (carried?.is_estimate ?? false),
        estimate_source: estimate?.source ?? carried?.estimate_source ?? null,
      });
      toast.success(`Saved "${form.name.trim()}" for quick logging later`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this meal");
    }
  }

  async function removeSavedMeal(name: string) {
    try {
      await deleteMealTemplate.mutateAsync(name);
      toast.success(`Removed "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove that saved meal");
    }
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
        const t = touchedRef.current;
        // All four totals already hand-set (e.g. a scanned item's exact
        // macros, or a manual itemized edit) means this re-estimate would
        // only replace a real breakdown with a rough guess for the food name
        // as a whole — skip it and leave the existing items/estimate alone.
        const allTouched = t.calories && t.protein_g && t.carbs_g && t.fat_g;
        if (!allTouched) {
          setEstimate(result);
          setCarried(null);
          setItems(result.items ?? []);
          setExpandedItem(null);
        }
        setForm((s) => ({
          ...s,
          calories: t.calories ? s.calories : String(result.calories),
          protein_g: t.protein_g ? s.protein_g : String(result.protein),
          carbs_g: t.carbs_g ? s.carbs_g : String(result.carbs),
          fat_g: t.fat_g ? s.fat_g : String(result.fat),
        }));
      } finally {
        setEstimating(false);
      }
    }, 600);

    return () => window.clearTimeout(handle);
    // touched is intentionally excluded — read via touchedRef instead, so a
    // hand-edit of a total field doesn't restart this debounce/re-fetch (which
    // would also blow away any itemized-list edits made in the meantime).
  }, [form.name, form.serving_amount, photo, ready, isEdit, descEdited]);

  async function estimateMacros() {
    if (!form.name.trim() && !photo) {
      toast.error("Add a food name (or a photo plus a name) to estimate macros.");
      return;
    }
    // A manual re-estimate replaces hand-typed numbers — never do that silently.
    const hasEdits = Object.values(touchedRef.current).some(Boolean) || items.some((i) => i.edited);
    if (
      hasEdits &&
      !window.confirm("Re-estimating will replace the numbers you edited. Continue?")
    ) {
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
      setCarried(null);
      setItems(result.items ?? []);
      setExpandedItem(null);
      // Manual re-estimate overrides everything, including hand-edited fields (confirmed above).
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

  // Item edits are the primary way to correct a multi-food estimate — they
  // recompute and write the same total fields the single-item form always
  // had, so save behavior is unchanged either way.
  function syncTotalsFromItems(nextItems: EstimatedItem[]) {
    const sum = nextItems.reduce(
      (acc, it) => ({
        calories: acc.calories + it.calories,
        protein: acc.protein + it.protein,
        carbs: acc.carbs + it.carbs,
        fat: acc.fat + it.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    setForm((s) => ({
      ...s,
      calories: String(Math.round(sum.calories)),
      protein_g: String(round(sum.protein, 1)),
      carbs_g: String(round(sum.carbs, 1)),
      fat_g: String(round(sum.fat, 1)),
    }));
    setTouched(ALL_MACROS_TOUCHED);
  }

  function updateItem(index: number, patch: Partial<EstimatedItem>) {
    setItems((current) => {
      const next = current.map((it, i) => {
        if (i !== index) return it;
        const changedNumbers =
          patch.calories !== undefined ||
          patch.protein !== undefined ||
          patch.carbs !== undefined ||
          patch.fat !== undefined;
        const merged: EstimatedItem = { ...it, ...patch };
        if (!changedNumbers) return merged;
        // The user's number now stands in for the source's: mark it, and re-run
        // the sanity checks on what they typed instead of keeping stale warnings.
        const { flags: _stale, ...rest } = merged;
        const edited: EstimatedItem = { ...rest, edited: true, provenance: "user" };
        const flags = validateItem(edited);
        return flags.length ? { ...edited, flags } : edited;
      });
      syncTotalsFromItems(next);
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((current) => {
      const next = current.filter((_, i) => i !== index);
      syncTotalsFromItems(next);
      return next;
    });
    setExpandedItem(null);
  }

  // A scanned product is exact (from its own label), not an approximation —
  // added straight to the item list rather than routed through the
  // auto-estimate text pipeline. Appends to whatever's already there, so
  // scanning a second item after typing/scanning a first just adds to the
  // same meal instead of replacing it.
  function addScannedItem(item: EstimatedItem) {
    setItems((current) => {
      const next = [...current, item];
      syncTotalsFromItems(next);
      return next;
    });
    setForm((s) => ({
      ...s,
      name: s.name.trim() ? `${s.name.trim()} + ${item.label}` : item.label,
    }));
    toast.success(`Added "${item.label}"`);
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

    // Foods with no nutrition data are left out of the totals rather than
    // guessed. If that leaves the whole meal at zero, say so before saving.
    const currentItems =
      usedEstimate && usedEstimate !== estimate ? (usedEstimate.items ?? []) : items;
    const unresolved = currentItems.filter((i) => i.provenance === "none");
    const allZero =
      Number(calories || 0) === 0 &&
      Number(protein_g || 0) === 0 &&
      Number(carbs_g || 0) === 0 &&
      Number(fat_g || 0) === 0;
    if (
      unresolved.length > 0 &&
      allZero &&
      !window.confirm(
        `No nutrition data was found for ${unresolved.map((i) => `"${i.label}"`).join(", ")}, so this meal would be saved with 0 calories. Save anyway?`,
      )
    ) {
      return;
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
      is_estimate: usedEstimate !== null || (carried?.is_estimate ?? false),
      estimate_source: usedEstimate?.source ?? carried?.estimate_source ?? null,
    };

    try {
      if (isEdit && editId) {
        await update.mutateAsync({ id: editId, ...fields, photo, photo_path: existingPhotoPath });
        toast.success("Meal updated");
      } else {
        await create.mutateAsync({ ...fields, photo });
        const protein = Math.round(fields.protein_g);
        toast.success(protein > 0 ? `Meal logged ✓ · +${protein}g protein` : "Meal logged ✓");
      }
      celebrate();
      playSaveTone();
      triggerHaptic();
      // Let the checkmark actually be seen before the page changes.
      window.setTimeout(() => navigate({ to: "/dashboard" }), 550);
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
  const previewUrl = photoUrl ?? (existingPhotoPath ? (existingPhoto.data ?? null) : null);
  const saving = create.isPending || update.isPending;
  // The per-item list shows for several foods, or when the one food has no data
  // (so the user can see and fill it in); a single matched food gets a compact
  // source line instead of a one-row list plus an identical total.
  const showItemList = items.length > 1 || items.some((i) => i.provenance === "none");
  const soloItem = items.length === 1 ? items[0] : undefined;
  const recentMeals = recent.data ?? [];
  const frequentFoods = frequent.data ?? [];
  const savedMeals = saved.data ?? [];
  const TAB_LABEL: Record<typeof quickAddTab, string> = {
    recent: "Repeat a recent meal",
    frequent: "Foods you log often",
    saved: "Your saved meals",
  };

  return (
    <AppShell
      title={isEdit ? "Edit Meal" : "Add Meal"}
      subtitle={
        isEdit ? "Update anything and save" : "Photo optional · every estimate stays editable"
      }
    >
      <div className="mb-3 flex justify-end">
        <SectionGuide section="food" />
      </div>
      {barcodeSupported ? (
        <BarcodeScannerDialog
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onDetected={addScannedItem}
        />
      ) : null}

      {!isEdit && (recentMeals.length > 0 || savedMeals.length > 0) ? (
        <div className="panel mb-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {TAB_LABEL[quickAddTab]}
            </p>
            <div
              role="tablist"
              aria-label="Quick add source"
              className="inline-flex shrink-0 rounded-full border border-border bg-secondary p-0.5 text-[11px]"
            >
              {(["recent", "frequent", "saved"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={quickAddTab === tab}
                  onClick={() => setQuickAddTab(tab)}
                  className={`rounded-full px-2.5 py-1 font-medium capitalize transition-colors ${
                    quickAddTab === tab
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickAddTab === "recent" ? (
              recentMeals.map((t) => (
                <QuickAddChip key={t.name} meal={t} onClick={() => applyTemplate(t)} />
              ))
            ) : quickAddTab === "frequent" ? (
              frequent.isLoading ? (
                <Skeleton className="h-7 w-40 rounded-full" />
              ) : frequentFoods.length > 0 ? (
                frequentFoods.map((food) => (
                  <FrequentFoodChip
                    key={food.name}
                    food={food}
                    onClick={() => applyFrequentFood(food)}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Log a meal a couple of times to see it here.
                </p>
              )
            ) : saved.isLoading ? (
              <Skeleton className="h-7 w-40 rounded-full" />
            ) : saved.isError ? (
              <p className="text-xs text-muted-foreground">Saved meals aren't set up yet.</p>
            ) : savedMeals.length > 0 ? (
              savedMeals.map((t) => (
                <QuickAddChip
                  key={t.name}
                  meal={t}
                  onClick={() => applyTemplate(t)}
                  onDelete={() => removeSavedMeal(t.name)}
                />
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Save a meal from the form below to see it here.
              </p>
            )}
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
              <img
                src={previewUrl}
                alt="Selected meal"
                className="aspect-square w-full rounded-xl object-cover"
              />
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
          <Button
            type="button"
            variant="secondary"
            className="mt-3 w-full"
            onClick={estimateMacros}
            disabled={estimating}
          >
            <Sparkles className="size-4" />{" "}
            {estimating
              ? "Estimating…"
              : estimate
                ? "Re-estimate calories & macros"
                : "Estimate calories & macros"}
          </Button>
          <p className="mt-3 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
            Calories and macros fill in <strong>automatically</strong> from your food name and
            serving size, using a reference food table and typical portions — or from a{" "}
            <strong>photo</strong> when photo analysis is enabled. They are{" "}
            <strong>approximate</strong>, not measured — edit any number and your value is kept.
            Separate several foods with <strong>+</strong> and each is added up.
          </p>
          {estimate ? (
            <div className="mt-2 space-y-1 text-xs">
              <p className="text-primary">
                {estimate.note} (confidence ≈ {Math.round(estimate.confidence * 100)}%)
              </p>
              {estimate.needsReview ? (
                <p
                  role="status"
                  className="flex items-start gap-1 text-amber-700 dark:text-amber-300"
                >
                  <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  Please review the highlighted items before saving.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="panel space-y-4 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">Food name</Label>
              <div className="flex items-center gap-1">
                {barcodeSupported ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanLine className="size-3" aria-hidden="true" />
                    Scan barcode
                  </Button>
                ) : null}
                {!isEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={saveAsTemplate}
                    disabled={saveMealTemplate.isPending}
                  >
                    <Bookmark className="size-3" aria-hidden="true" />
                    Save for later
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="relative">
              <Input
                id="name"
                required
                placeholder="Grilled chicken breast + rice + salad"
                value={form.name}
                onChange={(e) => editDescription({ name: e.target.value })}
                className={speech.supported ? "pr-10" : undefined}
              />
              {speech.supported ? (
                <button
                  type="button"
                  onClick={() => (speech.listening ? speech.stop() : speech.start())}
                  aria-label={speech.listening ? "Stop voice input" : "Add food by voice"}
                  aria-pressed={speech.listening}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors ${
                    speech.listening
                      ? "animate-pulse text-destructive"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              List everything you ate, separated by <strong>+</strong> — e.g. “2 eggs + toast + 1
              apple”. Each item is estimated and added up.
              {speech.supported ? " Or tap the mic and say it." : ""}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((s) => ({ ...s, category: v }))}
              >
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
            {items.length === 1 && soloItem && !showItemList ? (
              <div className="rounded-lg border border-dashed border-border p-2.5">
                <ItemDetails item={soloItem} />
              </div>
            ) : null}
            {showItemList ? (
              <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
                {items.map((item, index) => (
                  <ItemRow
                    key={index}
                    item={item}
                    expanded={expandedItem === index}
                    onToggleExpand={() => setExpandedItem((cur) => (cur === index ? null : index))}
                    onChange={(patch) => updateItem(index, patch)}
                    onRemove={() => removeItem(index)}
                  />
                ))}
                <p className="pt-0.5 text-[11px] text-muted-foreground">
                  Edit any item above — the total below updates automatically.
                </p>
              </div>
            ) : null}
            {showItemList ? (
              <p className="text-xs font-semibold text-muted-foreground">Total</p>
            ) : null}
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
            <Button
              type="submit"
              className={`w-full transition-transform ${justSaved ? "scale-[1.03]" : ""}`}
              disabled={saving || justSaved}
            >
              {justSaved ? (
                <>
                  <Check className="size-4" /> Saved!
                </>
              ) : saving ? (
                "Saving…"
              ) : isEdit ? (
                "Update meal"
              ) : (
                "Save meal"
              )}
            </Button>
          </div>
        </section>
      </form>
    </AppShell>
  );
}
