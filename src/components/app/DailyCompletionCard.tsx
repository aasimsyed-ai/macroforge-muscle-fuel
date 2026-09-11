import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";

import { DayCelebration } from "./DayCelebration";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // storage unavailable — the card just won't remember it was seen/dismissed
  }
}

/**
 * A quiet, dismissible "Day complete" banner — shown once per day when both
 * calories (within a sane band of target) and protein target are hit. No
 * nagging partial-progress state; it only ever appears when there's actually
 * something to celebrate, and only once.
 */
export function DailyCompletionCard({
  date,
  calories,
  calorieTarget,
  protein,
  proteinTarget,
}: {
  date: string;
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
}) {
  const caloriePct = calorieTarget > 0 ? (calories / calorieTarget) * 100 : 0;
  const proteinPct = proteinTarget > 0 ? (protein / proteinTarget) * 100 : 0;
  const complete = caloriePct >= 90 && caloriePct <= 110 && proteinPct >= 100;

  const dismissedKey = `mf:day-complete-dismissed:${date}`;
  const seenKey = `mf:day-complete-seen:${date}`;

  const [dismissed, setDismissed] = useState(() => readFlag(dismissedKey));
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    if (!complete) return;
    if (!readFlag(seenKey)) {
      writeFlag(seenKey);
      setShowBurst(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, seenKey]);

  if (!complete || dismissed) return null;

  return (
    <div className="panel relative overflow-hidden p-4">
      {showBurst ? <DayCelebration /> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <PartyPopper className="size-5 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Day complete ✓</p>
            <p className="text-xs text-muted-foreground">Calories and protein both on target today.</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={() => {
            writeFlag(dismissedKey);
            setDismissed(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
