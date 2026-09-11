import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dumbbell, Plus, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { guestActive } from "@/lib/guest";
import { useTrainingPreferences, useWorkoutStats } from "@/lib/workouts/hooks";
import { runWorkoutNotifications } from "@/lib/workouts/notifications";

import { ExperienceLevelCard } from "./ExperienceLevelCard";
import { NotificationPreferences } from "./NotificationPreferences";
import { ProgressionSuggestion } from "./ProgressionSuggestion";
import { WearableConnectionCard } from "./WearableConnectionCard";
import { WhatsAppSettings } from "./WhatsAppSettings";
import { WorkoutHistory } from "./WorkoutHistory";
import { WorkoutLogger } from "./WorkoutLogger";
import { WorkoutSummaryCards } from "./WorkoutSummaryCards";

export function WorkoutDashboard({
  fromDate,
  toDate,
  bodyWeightKg,
}: {
  fromDate: string;
  toDate: string;
  bodyWeightKg: number | null;
}) {
  const [logging, setLogging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const stats = useWorkoutStats(fromDate, toDate);
  const preferences = useTrainingPreferences();

  const isGuest = guestActive();
  const prefsData = preferences.data;

  useEffect(() => {
    if (isGuest || !prefsData) return;
    runWorkoutNotifications(prefsData).catch(() => undefined);
  }, [isGuest, prefsData]);

  if (isGuest) {
    return (
      <div className="panel mt-5 p-6 text-center">
        <Dumbbell className="mx-auto size-6 text-primary" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold">Workout tracking needs an account</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Workouts sync to your account so your training history and progression insights follow you
          across devices. Food tracking stays available on this device.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link to="/auth" search={{ mode: "signup" }}>
            Create a free account
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Log a workout</p>
            <p className="text-xs text-muted-foreground">
              Manual entry is the source of truth for exercises, sets, reps and load.
            </p>
          </div>
          {!logging ? (
            <Button type="button" size="sm" onClick={() => setLogging(true)}>
              <Plus className="size-4" /> Log workout
            </Button>
          ) : null}
        </div>
        {logging ? (
          <div className="mt-4">
            <WorkoutLogger
              bodyWeightKg={bodyWeightKg}
              onSaved={() => {
                setLogging(false);
                if (prefsData) runWorkoutNotifications(prefsData, { force: true }).catch(() => undefined);
              }}
              onCancel={() => setLogging(false)}
            />
          </div>
        ) : null}
      </div>

      {stats.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : stats.isError ? (
        <p className="panel p-6 text-center text-sm text-muted-foreground">
          Could not load workout data. If you just enabled workout tracking, the database migration
          may not be applied yet.
        </p>
      ) : stats.data && stats.data.workouts === 0 ? (
        <>
          <p className="panel p-6 text-center text-sm text-muted-foreground">
            No workouts in this range yet. Log your first session to start building history —
            progression insights unlock after several weeks of consistent logging.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProgressionSuggestion />
            <ExperienceLevelCard />
          </div>
        </>
      ) : stats.data ? (
        <>
          <WorkoutSummaryCards stats={stats.data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ProgressionSuggestion />
            <ExperienceLevelCard />
          </div>
          <section aria-label="Workout history">
            <h2 className="mb-2 text-lg font-semibold">Workout history</h2>
            <WorkoutHistory sessions={stats.data.sessions} bodyWeightKg={bodyWeightKg} />
          </section>
        </>
      ) : null}

      <div>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          aria-expanded={showSettings}
          onClick={() => setShowSettings((value) => !value)}
        >
          <Settings2 className="size-4" />
          Training settings & notifications
        </button>
        {showSettings ? (
          <div className="mt-3 space-y-4">
            <NotificationPreferences />
            <WearableConnectionCard />
            <WhatsAppSettings />
          </div>
        ) : null}
      </div>
    </div>
  );
}
