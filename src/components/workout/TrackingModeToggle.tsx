import { Dumbbell, UtensilsCrossed } from "lucide-react";

import type { TrackingMode } from "@/lib/workouts/useTrackingMode";

const OPTIONS: { value: TrackingMode; label: string; icon: typeof Dumbbell }[] = [
  { value: "food", label: "Food", icon: UtensilsCrossed },
  { value: "workout", label: "Workout", icon: Dumbbell },
];

export function TrackingModeToggle({
  mode,
  onChange,
}: {
  mode: TrackingMode;
  onChange: (mode: TrackingMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Tracking mode"
      className="inline-flex rounded-full border border-border bg-card p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
