import type { HalkuAnswer, HalkuKnownData } from "./types";

/**
 * Halku's v1 "brain": a small, honest, keyword-based responder — not a
 * free-form LLM. It answers accurately from a fixed set of real fitness/
 * nutrition definitions, and grounds personal questions only in data the
 * caller actually passed it (never fetches or invents anything itself). When
 * it can't confidently classify a question, it says so rather than guessing.
 * See docs — this is the documented v1; a real LLM-backed provider (mirroring
 * the analyze-food edge function pattern) is the natural next step and is
 * wired to be triable first via `halku/api.ts`, falling back to this.
 */

export type HalkuIntentKind =
  | "define_progressive_overload"
  | "define_sets_reps"
  | "define_rir_rpe"
  | "define_rest"
  | "define_weight_field"
  | "how_to_log_homemade_food"
  | "why_protein_target"
  | "why_progression_status"
  | "greeting"
  | "unknown";

export interface HalkuIntent {
  kind: HalkuIntentKind;
  /** A canonical muscle-group name extracted from the question, if any. */
  muscleGroupHint?: string;
}

const MUSCLE_GROUP_KEYWORDS: ReadonlyArray<{ keywords: string[]; group: string }> = [
  { keywords: ["chest", "bench press"], group: "Chest" },
  { keywords: ["back", "lat pulldown", "pull-up", "pullup", " row"], group: "Back" },
  { keywords: ["shoulder", "delt"], group: "Shoulders" },
  { keywords: ["bicep"], group: "Biceps" },
  { keywords: ["tricep"], group: "Triceps" },
  { keywords: ["leg", "squat", "quad", "hamstring", "calf"], group: "Legs" },
  { keywords: ["glute"], group: "Glutes" },
  { keywords: ["core", "abs", " ab "], group: "Core" },
];

function includesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function extractMuscleGroupHint(text: string): string | undefined {
  return MUSCLE_GROUP_KEYWORDS.find((entry) => includesAny(text, entry.keywords))?.group;
}

/** Pure and deterministic — same input always classifies the same way. */
export function classifyHalkuQuestion(raw: string): HalkuIntent {
  const text = ` ${raw.trim().toLowerCase()} `;
  if (text.trim().length === 0) return { kind: "unknown" };

  if (includesAny(text, ["progressive overload", "overload"])) {
    return { kind: "define_progressive_overload" };
  }
  if (includesAny(text, ["rir", "rpe"])) {
    return { kind: "define_rir_rpe" };
  }
  if (
    includesAny(text, [
      "what are sets",
      "sets and reps",
      "what is a rep",
      "what are reps",
      "what is a set",
    ])
  ) {
    return { kind: "define_sets_reps" };
  }
  if (includesAny(text, ["rest between", "how long should i rest", "what is rest", "rest time"])) {
    return { kind: "define_rest" };
  }
  if (
    includesAny(text, [
      "what should i enter for weight",
      "what does weight mean",
      "what is the weight field",
    ]) ||
    (text.includes("weight") && text.includes("enter"))
  ) {
    return { kind: "define_weight_field" };
  }
  if (
    includesAny(text, [
      "homemade",
      "home cooked",
      "home-cooked",
      "own recipe",
      "log homemade",
      "cooked at home",
    ])
  ) {
    return { kind: "how_to_log_homemade_food" };
  }
  if (includesAny(text, ["protein target", "protein goal", "why is my protein"])) {
    return { kind: "why_protein_target" };
  }
  if (
    includesAny(text, [
      "progress",
      "progression",
      "increase",
      "recommend",
      "why didn't you",
      "why did my",
    ])
  ) {
    const muscleGroupHint = extractMuscleGroupHint(text);
    return muscleGroupHint
      ? { kind: "why_progression_status", muscleGroupHint }
      : { kind: "why_progression_status" };
  }
  if (includesAny(text, [" hi ", " hello", "hey halku", "hey there"]) && raw.trim().length < 20) {
    return { kind: "greeting" };
  }
  return { kind: "unknown" };
}

const STATUS_LABEL: Record<string, string> = {
  progressed: "Progressed",
  maintained: "Maintained",
  decreased: "Decreased",
  insufficient_data: "Not enough data yet",
};

/** Assembles the final answer text. Pure given the intent and the data passed in. */
export function buildHalkuAnswer(intent: HalkuIntent, data: HalkuKnownData): HalkuAnswer {
  switch (intent.kind) {
    case "define_progressive_overload":
      return {
        grounded: false,
        text: "Progressive overload means giving a muscle a bit more of a challenge over time than it's used to — more weight at the same reps, more reps at the same weight, or more sets. That's what drives strength and muscle growth. Just moving more total weight isn't the same thing if it only comes from extra, unrelated sets.",
      };
    case "define_sets_reps":
      return {
        grounded: false,
        text: 'A rep (repetition) is one full movement of an exercise. A set is a group of reps done back-to-back before resting — "3 sets of 10" means 3 groups of 10 reps, with rest between each group.',
      };
    case "define_rir_rpe":
      return {
        grounded: false,
        text: "RIR (reps in reserve) and RPE (rate of perceived exertion) describe how close to failure a set felt. This app doesn't ask for them when logging a set, to keep entry quick — reps, weight and completed sets are enough to track real progression.",
      };
    case "define_rest":
      return {
        grounded: false,
        text: "Rest is how long you pause between sets, in seconds, so you recover a bit before the next one. It defaults to 60 seconds and you can change it per set.",
      };
    case "define_weight_field":
      return {
        grounded: false,
        text: "Enter the load you actually lifted for that set, in kilograms — the weight on the bar, machine or dumbbells, not your own bodyweight. For a bodyweight exercise, only fill it in if you added extra weight (a vest, a belt, a plate).",
      };
    case "how_to_log_homemade_food":
      return {
        grounded: false,
        text: 'Type what you made in the Food name field — e.g. "chicken curry with rice" — and the estimate is calculated from the description. You can also attach a photo or use the mic, and every number stays editable before you save.',
      };
    case "why_protein_target":
      if (data.today) {
        return {
          grounded: true,
          text: `Your data shows your current daily protein target is ${data.today.proteinTargetG} g. Targets come from your goal and body weight in Settings — building muscle needs more protein per kg than just maintaining weight, so it's set higher than a general "eat healthy" number. You can change it in Settings any time.`,
        };
      }
      return {
        grounded: false,
        text: "Your protein target comes from your goal and body weight, set in Settings — muscle building typically needs more protein per kg than just maintaining weight. You can change it in Settings any time.",
      };
    case "why_progression_status": {
      const rows = data.progressRows ?? [];
      const match = intent.muscleGroupHint
        ? rows.find((row) => row.muscleGroup === intent.muscleGroupHint)
        : rows[0];
      if (match) {
        return {
          grounded: true,
          text: `Your data shows ${match.exerciseName} (${match.muscleGroup}) is currently: ${STATUS_LABEL[match.status] ?? match.status}. ${match.explanation}`,
        };
      }
      if (rows.length === 0) {
        return {
          grounded: false,
          text: "I don't have enough logged workout data yet to answer that — log a couple of comparable sessions for that exercise, then check the Progress tab and ask again.",
        };
      }
      return {
        grounded: false,
        text: "I couldn't match that to one of your recently tracked exercises. Open the Progress tab and ask me from there, or name the exact exercise.",
      };
    }
    case "greeting":
      return {
        grounded: false,
        text: "Hey, I'm Halku, your personal AI trainer. Ask me about progressive overload, how to log something, or why an exercise's progress changed.",
      };
    case "unknown":
    default:
      return {
        grounded: false,
        text: "I'm not confident I understood that one — try asking about progressive overload, sets and reps, how to log a meal, or why a specific exercise's progress changed. I'll always say so instead of guessing when I'm not sure.",
      };
  }
}

export function answerHalkuQuestionLocally(question: string, data: HalkuKnownData): HalkuAnswer {
  return buildHalkuAnswer(classifyHalkuQuestion(question), data);
}
