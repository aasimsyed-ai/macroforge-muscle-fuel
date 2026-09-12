import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { WorkoutAccountRequired } from "@/components/workout/WorkoutAccountRequired";
import { WorkoutLogger } from "@/components/workout/WorkoutLogger";
import { guestActive } from "@/lib/guest";
import { useCurrentBodyWeightKg } from "@/lib/useCurrentBodyWeightKg";
import { useTrackingMode } from "@/lib/workouts/useTrackingMode";

export const Route = createFileRoute("/_authenticated/log-workout")({
  head: () => ({
    meta: [
      { title: "Log Workout — MacroForge" },
      {
        name: "description",
        content: "Log exercises, sets and load — the same structured workout tracker as the Workout tab.",
      },
    ],
  }),
  component: LogWorkout,
});

function LogWorkout() {
  const navigate = useNavigate();
  const bodyWeightKg = useCurrentBodyWeightKg();
  // Land on the Workout view of the dashboard afterwards, so the session just
  // logged is immediately visible instead of the Food view.
  const [, setTrackingMode] = useTrackingMode();
  const isGuest = guestActive();

  function backToDashboard() {
    setTrackingMode("workout");
    navigate({ to: "/dashboard" });
  }

  return (
    <AppShell title="Log Workout" subtitle="Exercises, sets and load — the same tracker as the Workout tab">
      {isGuest ? (
        // Tell a guest up front that workouts need an account, before they
        // spend time filling in exercises/sets that would fail at save time.
        <WorkoutAccountRequired />
      ) : (
        <div className="panel mt-2 p-4">
          <WorkoutLogger bodyWeightKg={bodyWeightKg} onSaved={backToDashboard} onCancel={backToDashboard} />
        </div>
      )}
    </AppShell>
  );
}
