import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, subDays } from "date-fns";
import { Download, Droplets, Dumbbell, Moon, Pill, Scale, Ruler } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app/AppShell";
import { DailyCompletionCard } from "@/components/app/DailyCompletionCard";
import { DayCelebration } from "@/components/app/DayCelebration";
import { MealList } from "@/components/app/MealList";
import { MetricsQuickLog } from "@/components/app/MetricsQuickLog";
import { ProgressRing } from "@/components/app/ProgressRing";
import { StatCard } from "@/components/app/StatCard";
import { StreakBadges } from "@/components/app/StreakBadges";
import { BodyTrendChart, DailyIntakeChart, HabitChart } from "@/components/app/TrendCharts";
import { StrengthMiniTrend } from "@/components/app/StrengthMiniTrend";
import { WeeklyRecapCard } from "@/components/app/WeeklyRecapCard";
import { WeightJourneyCard } from "@/components/app/WeightJourneyCard";
import { TrackingModeToggle } from "@/components/workout/TrackingModeToggle";
import { WorkoutDashboard } from "@/components/workout/WorkoutDashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { playMilestoneTone, triggerHaptic } from "@/lib/celebrationEffects";
import { useAllMetrics, useGoals, useMeals, useMetrics, useProfile } from "@/lib/data";
import { fetchMilestoneCounts, fetchProteinHitDays, runMilestoneCheck } from "@/lib/milestones";
import { aggregateDailyProtein, computeLoggingStreak, computeProteinStreak } from "@/lib/streaks";
import { useCurrentBodyWeightKg } from "@/lib/useCurrentBodyWeightKg";
import { useWorkoutStats } from "@/lib/workouts/hooks";
import { useTrackingMode } from "@/lib/workouts/useTrackingMode";
import {
  RANGE_OPTIONS,
  downloadCsv,
  resolveRange,
  round,
  sumMeals,
  toCsv,
  type RangeKey,
} from "@/lib/nutrition";

const searchSchema = z.object({
  range: z
    .enum(["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "custom"])
    .optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Dashboard — MacroForge" },
      {
        name: "description",
        content: "Your calories, protein, macros, body metrics and training consistency at a glance.",
      },
      { property: "og:title", content: "Dashboard — MacroForge" },
      { property: "og:description", content: "Daily targets, macro rings and lean-bulk trends." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const rangeKey: RangeKey = search.range ?? "today";
  const range = resolveRange(rangeKey, {
    ...(search.from ? { from: search.from } : {}),
    ...(search.to ? { to: search.to } : {}),
  });

  const [trackingMode, setTrackingMode] = useTrackingMode();

  const profile = useProfile();
  const goalsQuery = useGoals();
  const rangeMeals = useMeals(range.from, range.to);
  const rangeMetrics = useMetrics(range.from, range.to);
  const allMetrics = useAllMetrics();
  // workout_sessions (the structured logger) is the source of truth for
  // workout-day counts and the habit chart's workout bar — shares its cache
  // with WorkoutDashboard's own call for the same range (same query key), so
  // this doesn't add a second network request when viewing Workout mode.
  const rangeWorkoutStats = useWorkoutStats(
    format(range.from, "yyyy-MM-dd"),
    format(range.to, "yyyy-MM-dd"),
  );
  // A fixed 90-day lookback for streaks — independent of whatever range is
  // currently selected above, and bounded so it doesn't grow unbounded over
  // time. Computed once per mount so the query key stays stable (otherwise a
  // fresh `new Date()` on every render would refetch on every render).
  const streakWindow = useMemo(() => {
    const now = new Date();
    return { from: subDays(now, 90), to: now };
  }, []);
  const streakMeals = useMeals(streakWindow.from, streakWindow.to);
  const dailyProteinTotals = useMemo(
    () => aggregateDailyProtein(streakMeals.data ?? []),
    [streakMeals.data],
  );

  const [milestoneBurstKey, setMilestoneBurstKey] = useState(0);

  const goals = goalsQuery.data;
  const loading = goalsQuery.isLoading || rangeMeals.isLoading;

  // Check milestones once the goal target and streak window are both ready.
  // Best-effort: never blocks or errors the dashboard if it fails.
  useEffect(() => {
    if (!goals) return;
    let cancelled = false;
    (async () => {
      try {
        const [counts, proteinHitDays] = await Promise.all([
          fetchMilestoneCounts(),
          // A wider, dedicated lookback than the 90-day streak window — a
          // milestone counting toward 20 lifetime hits shouldn't lose credit
          // for hits that happen to fall outside the streak's short window.
          fetchProteinHitDays(goals.protein_target_g),
        ]);
        const fresh = await runMilestoneCheck({
          totalMeals: counts.totalMeals,
          totalWorkouts: counts.totalWorkouts,
          loggingStreak: computeLoggingStreak(dailyProteinTotals, new Date()),
          proteinHitDays,
        });
        if (cancelled || fresh.length === 0) return;
        for (const draft of fresh) {
          toast.success(draft.title, { description: draft.message });
        }
        setMilestoneBurstKey((k) => k + 1);
        playMilestoneTone();
        triggerHaptic([15, 40, 15]);
      } catch {
        // milestones are a nice-to-have — never surface this as an error
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, dailyProteinTotals]);

  const rangeTotals = sumMeals(rangeMeals.data);
  const days = Math.max(1, range.days);
  const isSingleDay = days <= 1;
  // For a single day the rings show that day's totals; for a multi-day range
  // they show the daily average, so the section always reflects the selection.
  const progress = isSingleDay
    ? { calories: rangeTotals.calories, protein: rangeTotals.protein, carbs: rangeTotals.carbs, fat: rangeTotals.fat }
    : {
        calories: rangeTotals.calories / days,
        protein: rangeTotals.protein / days,
        carbs: rangeTotals.carbs / days,
        fat: rangeTotals.fat / days,
      };

  const metrics = rangeMetrics.data ?? [];
  // The quick-log widget edits a single day: the selected day itself when the
  // range is one day (Today/Yesterday/a custom single date), otherwise the most
  // recent day in the range — never hardcoded to today, so it always matches
  // whatever the range picker above it says.
  const quickLogDate = format(isSingleDay ? range.from : range.to, "yyyy-MM-dd");
  const quickLogMetric = (allMetrics.data ?? []).find((m) => m.metric_date === quickLogDate);
  const weighIns = (allMetrics.data ?? []).filter((m) => m.weight_kg != null);
  const latestWeight = weighIns.length ? Number(weighIns[weighIns.length - 1]!.weight_kg) : null;
  const waistLogs = (allMetrics.data ?? []).filter((m) => m.waist_cm != null);
  const latestWaist = waistLogs.length ? Number(waistLogs[waistLogs.length - 1]!.waist_cm) : null;

  // Latest logged body weight (daily metrics) with the profile weight as fallback,
  // used only to estimate workout calories. Shared with the standalone Log
  // Workout page so both compute it the same way.
  const currentBodyWeightKg = useCurrentBodyWeightKg();

  // Union of both sources: a day counts if it has a structured workout_session
  // (the current source of truth) OR an old manually-typed quick-log entry
  // (so historical data logged before the structured logger existed still
  // counts — nothing that used to count stops counting).
  const workoutMinutesByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of rangeWorkoutStats.data?.sessions ?? []) {
      map.set(session.workout_date, (map.get(session.workout_date) ?? 0) + (session.duration_minutes ?? 0));
    }
    return map;
  }, [rangeWorkoutStats.data]);
  const workoutDays = new Set([
    ...metrics.filter((m) => Number(m.workout_minutes ?? 0) > 0).map((m) => m.metric_date),
    ...workoutMinutesByDate.keys(),
  ]).size;
  const creatineDays = metrics.filter((m) => m.creatine_taken).length;
  const sleepLogs = metrics.filter((m) => m.sleep_hours != null);
  const avgSleep = sleepLogs.length
    ? round(sleepLogs.reduce((a, m) => a + Number(m.sleep_hours), 0) / sleepLogs.length, 1)
    : null;
  const waterLogs = metrics.filter((m) => m.water_ml != null);
  const avgWater = waterLogs.length
    ? Math.round(waterLogs.reduce((a, m) => a + Number(m.water_ml), 0) / waterLogs.length)
    : null;

  function setRange(next: RangeKey) {
    navigate({ to: "/dashboard", search: (prev) => ({ ...prev, range: next }) });
  }

  function exportCsv() {
    const rows = (rangeMeals.data ?? []).map((m) => ({
      eaten_at: m.eaten_at,
      name: m.name,
      category: m.category,
      serving: m.serving_amount ?? "",
      calories: m.calories,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
      approximate_estimate: m.is_estimate ? "yes" : "no",
      notes: m.notes ?? "",
    }));
    if (!rows.length) return;
    downloadCsv(`macroforge-meals-${format(range.from, "yyyyMMdd")}-${format(range.to, "yyyyMMdd")}.csv`, toCsv(rows));
  }

  if (loading || !goals) {
    return (
      <AppShell title="Dashboard">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  const remainingKcal = Math.max(0, goals.calorie_target - progress.calories);
  const remainingProtein = Math.max(0, goals.protein_target_g - progress.protein);

  const loggingStreak = computeLoggingStreak(dailyProteinTotals, new Date());
  const proteinStreak = computeProteinStreak(dailyProteinTotals, goals.protein_target_g, new Date());

  const startWeight =
    profile.data?.start_weight_kg != null ? Number(profile.data.start_weight_kg) : null;

  return (
    <AppShell
      title="Dashboard"
      subtitle={`${range.label} · ${latestWeight ? `${latestWeight} kg` : "no weigh-in yet"} → ${goals.target_weight_kg} kg goal`}
    >
      {milestoneBurstKey > 0 ? (
        <div className="pointer-events-none fixed left-1/2 top-24 z-50 -translate-x-1/2" aria-hidden="true">
          <DayCelebration key={milestoneBurstKey} />
        </div>
      ) : null}

      <div className="mb-3">
        <TrackingModeToggle mode={trackingMode} onChange={setTrackingMode} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.filter((o) => o.value !== "custom").map((o) => (
          <button
            key={o.value}
            onClick={() => setRange(o.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              rangeKey === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {o.label}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Custom range start"
            value={search.from ?? format(range.from, "yyyy-MM-dd")}
            onChange={(e) =>
              navigate({ to: "/dashboard", search: (p) => ({ ...p, range: "custom", from: e.target.value }) })
            }
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="Custom range end"
            value={search.to ?? format(range.to, "yyyy-MM-dd")}
            onChange={(e) =>
              navigate({ to: "/dashboard", search: (p) => ({ ...p, range: "custom", to: e.target.value }) })
            }
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
          />
        </div>
        {trackingMode === "food" ? (
          <Button variant="secondary" size="sm" onClick={exportCsv} className="ml-auto">
            <Download className="size-4" /> Export CSV
          </Button>
        ) : null}
      </div>

      {trackingMode === "workout" ? (
        <WorkoutDashboard
          fromDate={format(range.from, "yyyy-MM-dd")}
          toDate={format(range.to, "yyyy-MM-dd")}
          bodyWeightKg={currentBodyWeightKg}
        />
      ) : (
        <>
      <div className="mt-4 space-y-3">
        <StreakBadges loggingStreak={loggingStreak} proteinStreak={proteinStreak} />
        {rangeKey === "today" ? (
          <DailyCompletionCard
            date={quickLogDate}
            calories={progress.calories}
            calorieTarget={goals.calorie_target}
            protein={progress.protein}
            proteinTarget={goals.protein_target_g}
          />
        ) : null}
      </div>

      <section className="panel mt-3 p-4" aria-label="Goal progress">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">
            {isSingleDay ? `${range.label} · goal progress` : `${range.label} · daily average vs target`}
          </p>
          <p className="text-xs text-muted-foreground">
            {isSingleDay
              ? `${Math.round(remainingKcal)} kcal and ${round(remainingProtein, 1)} g protein remaining`
              : `averaging ${Math.round(progress.calories)} kcal and ${round(progress.protein, 1)} g protein per day`}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ProgressRing value={Math.round(progress.calories)} target={goals.calorie_target} label="Calories" unit=" kcal" />
          <ProgressRing value={round(progress.protein, 1)} target={goals.protein_target_g} label="Protein" unit=" g" tone="protein" />
          <ProgressRing value={round(progress.carbs, 1)} target={goals.carb_target_g} label="Carbs" unit=" g" tone="carbs" />
          <ProgressRing value={round(progress.fat, 1)} target={goals.fat_target_g} label="Fat" unit=" g" tone="fat" />
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={`${range.label} averages`}>
        <StatCard
          label={`${range.label} avg calories`}
          value={`${Math.round(rangeTotals.calories / days)}`}
          hint={`Target ${goals.calorie_target} kcal/day · ${rangeTotals.count} meals logged`}
        />
        <StatCard
          label={`${range.label} avg protein`}
          value={`${round(rangeTotals.protein / days, 1)} g`}
          hint={`Target ${goals.protein_target_g} g/day`}
        />
        <StatCard
          label="Workout consistency"
          value={`${workoutDays}/${days} days`}
          icon={<Dumbbell className="size-4" />}
          hint={`Goal ${goals.workout_days_per_week} sessions/week`}
        />
        <StatCard
          label="Creatine adherence"
          value={`${days ? Math.round((creatineDays / days) * 100) : 0}%`}
          icon={<Pill className="size-4" />}
          hint={`${creatineDays} of ${days} days`}
        />
        <StatCard
          label="Latest weight"
          value={latestWeight ? `${latestWeight} kg` : "—"}
          icon={<Scale className="size-4" />}
          hint={`Goal ${goals.target_weight_kg} kg · ${profile.data?.height_cm ?? 170} cm`}
        />
        <StatCard
          label="Latest waist"
          value={latestWaist ? `${latestWaist} cm` : "—"}
          icon={<Ruler className="size-4" />}
          hint="Keep this controlled while gaining"
        />
        <StatCard
          label="Avg sleep"
          value={avgSleep ? `${avgSleep} h` : "—"}
          icon={<Moon className="size-4" />}
          hint={`Target ${goals.sleep_target_hours} h`}
        />
        <StatCard
          label="Avg water"
          value={avgWater ? `${(avgWater / 1000).toFixed(1)} L` : "—"}
          icon={<Droplets className="size-4" />}
          hint={`Target ${(goals.water_target_ml / 1000).toFixed(1)} L`}
        />
      </section>

      <div className="mt-5">
        <WeeklyRecapCard />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <DailyIntakeChart
          meals={rangeMeals.data ?? []}
          calorieTarget={goals.calorie_target}
          proteinTarget={goals.protein_target_g}
        />
        <BodyTrendChart metrics={allMetrics.data ?? []} />
        {startWeight != null && latestWeight != null ? (
          <WeightJourneyCard
            startWeight={startWeight}
            currentWeight={latestWeight}
            goalWeight={goals.target_weight_kg}
          />
        ) : null}
        <HabitChart metrics={metrics} workoutMinutesByDate={workoutMinutesByDate} />
        <StrengthMiniTrend />
        <MetricsQuickLog date={quickLogDate} metric={quickLogMetric} goals={goals} />
      </div>

      <section className="mt-6" aria-label="Meal history">
        <h2 className="mb-3 text-lg font-semibold">Meal history · {range.label}</h2>
        <MealList meals={rangeMeals.data ?? []} />
      </section>
        </>
      )}
    </AppShell>
  );
}
