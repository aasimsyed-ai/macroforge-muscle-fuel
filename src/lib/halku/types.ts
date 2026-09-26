import type { HalkuAnchorId } from "./anchors";

export type HalkuGender = "masculine" | "feminine";

export interface HalkuMessage {
  id: string;
  role: "user" | "halku";
  text: string;
  /** True when this answer used the user's real logged data (labelled "Your
   * data shows…" in the UI); false for general fitness/nutrition guidance. */
  grounded: boolean;
  /** UI-only: true when this message is a friendly failure notice (the
   * question couldn't be answered at all) rather than a real Halku reply —
   * styled distinctly so it never looks like a fabricated answer. */
  isError?: boolean;
}

export interface HalkuAnswer {
  text: string;
  grounded: boolean;
  /** The on-screen control the answer is about, for a future "show me" Guided Mode. Not rendered yet. */
  anchor?: HalkuAnchorId;
}

/** Real, already-fetched data Halku may ground an answer in. Never fetched or
 * invented by the responder itself — only ever what the caller actually has. */
export interface HalkuKnownData {
  /** This week's per-exercise progression rows, if the caller has them loaded. */
  progressRows?: ReadonlyArray<{
    exerciseName: string;
    muscleGroup: string;
    status: "progressed" | "maintained" | "decreased" | "insufficient_data";
    explanation: string;
  }>;
  /** Today's logged totals vs. targets, if available. */
  today?: {
    calories: number;
    proteinG: number;
    calorieTarget: number;
    proteinTargetG: number;
  } | null;
}
