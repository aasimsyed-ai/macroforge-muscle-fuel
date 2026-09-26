import type { ProgressionHistoryItem } from "./calculations";

/**
 * "Last time" context for an exercise in the workout logger — the most recent
 * logged session BEFORE the workout being entered, so editing today's workout
 * never reports itself as its own previous performance. Display only: it does
 * not feed the progressive-overload maths.
 */
export interface PreviousPerformance {
  /** yyyy-MM-dd of that session. */
  date: string;
  /** Most-used working weight that day, or null for bodyweight-only / unweighted. */
  weightKg: number | null;
  completedSets: number;
  /** Highest reps completed in any set that day (at any weight). */
  bestReps: number;
}

/** Latest session strictly before `beforeDate` (or overall when omitted) with at least one completed set. */
export function pickPreviousSession(
  history: readonly ProgressionHistoryItem[],
  beforeDate?: string | null,
): PreviousPerformance | null {
  let best: ProgressionHistoryItem | null = null;
  for (const item of history) {
    if (beforeDate && item.sessionDate >= beforeDate) continue;
    if (item.completedSets <= 0) continue;
    if (best === null || item.sessionDate > best.sessionDate) best = item;
  }
  if (!best) return null;
  return {
    date: best.sessionDate,
    weightKg: best.weightKg,
    completedSets: best.completedSets,
    bestReps: best.maxReps,
  };
}

function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

/** "60 kg · 3 sets · up to 10 reps" — states only what the history actually holds. */
export function formatPreviousPerformance(
  previous: PreviousPerformance,
  isBodyweight: boolean,
): string {
  const parts: string[] = [];
  if (previous.weightKg !== null && previous.weightKg > 0) {
    parts.push(`${formatKg(previous.weightKg)} kg${isBodyweight ? " added" : ""}`);
  } else if (isBodyweight) {
    parts.push("bodyweight");
  }
  parts.push(`${previous.completedSets} ${previous.completedSets === 1 ? "set" : "sets"}`);
  if (previous.bestReps > 0) parts.push(`up to ${previous.bestReps} reps`);
  return parts.join(" · ");
}

/** The weight worth offering to reuse, or null when the last session had none. */
export function weightToReuse(previous: PreviousPerformance): number | null {
  return previous.weightKg !== null && previous.weightKg > 0 ? previous.weightKg : null;
}
