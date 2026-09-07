import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ImageIcon, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteMeal, useMealPhotoUrl, type Meal } from "@/lib/data";
import { categoryLabel } from "@/lib/nutrition";

function MealPhoto({ path }: { path: string | null }) {
  const { data: url } = useMealPhotoUrl(path);
  if (!path) {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <ImageIcon className="size-5" aria-hidden="true" />
      </div>
    );
  }
  return url ? (
    <img src={url} alt="Meal photo" loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" />
  ) : (
    <div className="size-14 shrink-0 animate-pulse rounded-lg bg-secondary" />
  );
}

export function MealList({ meals }: { meals: Meal[] }) {
  const del = useDeleteMeal();

  if (!meals.length) {
    return (
      <p className="panel p-6 text-center text-sm text-muted-foreground">
        No meals logged in this range yet. Use “Add Meal” to log your first one.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {meals.map((m) => (
        <li key={m.id} className="panel flex items-start gap-3 p-3">
          <MealPhoto path={m.photo_path} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold">{m.name}</p>
              <Badge variant="secondary">{categoryLabel(m.category)}</Badge>
              {m.is_estimate ? <Badge variant="outline">Approximate</Badge> : null}
              {m.is_demo ? <Badge variant="outline">Demo</Badge> : null}
            </div>
            <p className="num mt-1 text-sm text-muted-foreground">
              {Math.round(Number(m.calories))} kcal · P {Number(m.protein_g)}g · C {Number(m.carbs_g)}g · F{" "}
              {Number(m.fat_g)}g
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(new Date(m.eaten_at), "EEE d MMM, HH:mm")}
              {m.serving_amount ? ` · ${m.serving_amount}` : ""}
            </p>
            {m.notes ? <p className="mt-1 text-xs text-muted-foreground">{m.notes}</p> : null}
          </div>
          <div className="flex shrink-0 items-center">
            <Button asChild variant="ghost" size="icon" aria-label={`Edit ${m.name}`}>
              <Link to="/add-meal" search={{ edit: m.id }}>
                <Pencil className="size-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${m.name}`}
              disabled={del.isPending}
              onClick={() => del.mutate(m.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
