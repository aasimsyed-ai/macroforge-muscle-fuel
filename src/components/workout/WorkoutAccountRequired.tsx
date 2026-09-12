import { Link } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown instead of the workout logger/dashboard for guests, before they type
 * anything — workouts need an account (they sync across devices), unlike
 * food tracking which works locally. Shared by WorkoutDashboard and the
 * standalone Log Workout route so both surfaces agree.
 */
export function WorkoutAccountRequired() {
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
