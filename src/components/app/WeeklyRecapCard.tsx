import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useMeals, useMetrics } from "@/lib/data";
import { resolveRange, round, sumMeals } from "@/lib/nutrition";
import { useWorkoutStats } from "@/lib/workouts/hooks";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function loggedDayCount(meals: { eaten_at: string }[] | undefined): number {
  if (!meals?.length) return 0;
  return new Set(meals.map((m) => format(new Date(m.eaten_at), "yyyy-MM-dd"))).size;
}

/** Collapsed by default — a quick, honest recap of the current week vs last week. */
export function WeeklyRecapCard() {
  const [open, setOpen] = useState(false);

  const thisWeek = useMemo(() => resolveRange("this_week"), []);
  const lastWeek = useMemo(() => resolveRange("last_week"), []);

  // Only fetch once the card is actually expanded — no point spending four
  // queries on a section most visits will never open.
  const thisMeals = useMeals(thisWeek.from, thisWeek.to, { enabled: open });
  const lastMeals = useMeals(lastWeek.from, lastWeek.to, { enabled: open });
  const thisMetrics = useMetrics(thisWeek.from, thisWeek.to, { enabled: open });
  const thisWorkouts = useWorkoutStats(
    format(thisWeek.from, "yyyy-MM-dd"),
    format(thisWeek.to, "yyyy-MM-dd"),
    { enabled: open },
  );

  const loading = thisMeals.isLoading || lastMeals.isLoading || thisMetrics.isLoading;

  const daysElapsed = Math.min(7, differenceInCalendarDays(new Date(), thisWeek.from) + 1);
  const totals = sumMeals(thisMeals.data);
  const avgCalories = daysElapsed > 0 ? totals.calories / daysElapsed : 0;
  const avgProtein = daysElapsed > 0 ? totals.protein / daysElapsed : 0;

  const thisLoggedDays = loggedDayCount(thisMeals.data);
  const lastLoggedDays = loggedDayCount(lastMeals.data);
  const thisConsistency = daysElapsed > 0 ? Math.round((thisLoggedDays / daysElapsed) * 100) : 0;
  const lastConsistency = Math.round((lastLoggedDays / 7) * 100);

  const creatineDays = (thisMetrics.data ?? []).filter((m) => m.creatine_taken).length;
  const workouts = thisWorkouts.data?.workouts ?? 0;

  const insight =
    thisConsistency >= lastConsistency
      ? "Your consistency improved from last week."
      : "A steady week — small tweaks build momentum.";

  return (
    <div className="panel p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-semibold">This week at a glance</p>
          <p className="text-xs text-muted-foreground">Tap for a quick weekly recap</p>
        </div>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open ? (
        loading ? (
          <Skeleton className="mt-3 h-32 w-full rounded-md" />
        ) : totals.count === 0 && workouts === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Nothing logged yet this week — log a meal or a workout and check back here.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5 text-sm">
            <Row label="Calories average" value={`${Math.round(avgCalories)} kcal`} />
            <Row label="Protein average" value={`${round(avgProtein, 1)} g`} />
            <Row label="Workouts" value={`${workouts}`} />
            <Row label="Creatine" value={`${creatineDays}/${daysElapsed}`} />
            <Row label="Logging consistency" value={`${thisConsistency}%`} />
            <p className="mt-2 text-xs text-primary">{insight}</p>
          </div>
        )
      ) : null}
    </div>
  );
}
