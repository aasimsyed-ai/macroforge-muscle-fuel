import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { WorkoutLogger } from "@/components/workout/WorkoutLogger";
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

  function backToDashboard() {
    setTrackingMode("workout");
    navigate({ to: "/dashboard" });
  }

  return (
    <AppShell title="Log Workout" subtitle="Exercises, sets and load — the same tracker as the Workout tab">
      <div className="panel mt-2 p-4">
        <WorkoutLogger bodyWeightKg={bodyWeightKg} onSaved={backToDashboard} onCancel={backToDashboard} />
      </div>
    </AppShell>
  );
}
