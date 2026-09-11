import { round } from "@/lib/nutrition";

/**
 * A simple visual "journey" from starting weight to goal weight — the same
 * underlying data as the weight trend chart, framed as progress toward a
 * destination rather than a line over time. Doesn't replace that chart.
 */
export function WeightJourneyCard({
  startWeight,
  currentWeight,
  goalWeight,
}: {
  startWeight: number;
  currentWeight: number;
  goalWeight: number;
}) {
  const span = goalWeight - startWeight;
  const progressed = currentWeight - startWeight;
  const pct = span !== 0 ? Math.max(0, Math.min(100, (progressed / span) * 100)) : 100;
  const remaining = Math.abs(round(goalWeight - currentWeight, 1));
  const reached = remaining < 0.1;

  return (
    <div className="panel p-4">
      <p className="text-sm font-semibold">Your journey</p>
      <p className="text-xs text-muted-foreground">
        {reached ? "Goal weight reached 🎯" : `${remaining} kg to go`}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="num shrink-0 text-xs font-semibold text-muted-foreground">{startWeight} kg</span>
        <div className="relative h-2 flex-1 rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow transition-[left] duration-700 ease-out"
            style={{ left: `${pct}%` }}
            aria-hidden="true"
          />
        </div>
        <span className="num shrink-0 text-xs font-semibold text-muted-foreground">
          {goalWeight} kg <span aria-hidden="true">🎯</span>
        </span>
      </div>

      <p className="mt-3">
        <span className="num text-lg font-bold">{currentWeight} kg</span>{" "}
        <span className="text-xs font-normal text-muted-foreground">now</span>
      </p>
    </div>
  );
}
