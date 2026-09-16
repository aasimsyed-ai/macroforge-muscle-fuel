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
  | "define_equipment_field"
  | "how_to_log_homemade_food"
  | "how_to_save_meal"
  | "how_to_add_set"
  | "how_to_collapse_exercise"
  | "fatigue_guidance"
  | "why_protein_target"
  | "why_progression_status"
  | "action_request"
  | "greeting"
  | "unknown";

/** Which part of the app an action_request is actually about, so the steps
 * Halku offers point somewhere real instead of a generic "open the app". */
export type HalkuActionTarget = "food" | "workout" | "goal";

export interface HalkuIntent {
  kind: HalkuIntentKind;
  /** A canonical muscle-group name extracted from the question, if any. */
  muscleGroupHint?: string;
  /** Only set for "action_request" — see HalkuActionTarget. */
  actionTarget?: HalkuActionTarget;
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
      "what does equipment",
      "what is equipment",
      "equipment do",
      "equipment mean",
      "equipment field",
      "equipment option",
    ])
  ) {
    return { kind: "define_equipment_field" };
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
  // Deliberately distinct from how_to_log_homemade_food above (a specific
  // case of this) and from action_request's "save this meal"/"save my
  // meal" (an imperative asking Halku to act right now) — "how do I save a
  // meal" / "save a meal" is a general how-to question about the ordinary
  // Add Meal flow, not a request to perform anything.
  if (includesAny(text, ["how do i save", "how to save a meal", "save a meal"])) {
    return { kind: "how_to_save_meal" };
  }
  if (includesAny(text, ["add a set", "add another set", "how do i add a set", "new set"])) {
    return { kind: "how_to_add_set" };
  }
  if (
    includesAny(text, [
      "collapse an exercise",
      "collapse exercise",
      "expand an exercise",
      "how do i collapse",
      "how do i expand",
    ])
  ) {
    return { kind: "how_to_collapse_exercise" };
  }
  if (
    includesAny(text, [
      "too fatigued",
      "too tired to",
      "fatigued to increase",
      "not recovered",
      "not fully recovered",
    ])
  ) {
    return { kind: "fatigue_guidance" };
  }
  // Checked before action_request below: "why" is the unambiguous signal
  // that this is a question about a past/current status, not a request to
  // do something right now. Without this, "Why didn't you increase my
  // bicep weight?" would match action_request's own "increase my" pattern
  // and get a capability-limit answer instead of the real, data-grounded
  // explanation it's actually asking for.
  if (includesAny(text, ["why didn't you", "why did my"])) {
    const muscleGroupHint = extractMuscleGroupHint(text);
    return muscleGroupHint
      ? { kind: "why_progression_status", muscleGroupHint }
      : { kind: "why_progression_status" };
  }
  // Requests for Halku to actually perform/change something — it can't (v1
  // has no write access to any table), so this exists purely to answer
  // honestly with the shortest real path, never to pretend the action
  // happened. Checked before why_protein_target below on purpose: e.g.
  // "Change my protein target" would otherwise match why_protein_target's
  // own "protein target" keyword and get a status explanation instead of
  // the capability-limit + steps this actually needs.
  if (
    includesAny(text, [
      "add my",
      "add today",
      "log my meal",
      "log my workout",
      "save this meal",
      "save my meal",
      "increase my",
      "change my protein",
      "change my target",
      "update my target",
      "update my goal",
    ])
  ) {
    const isWorkoutAction = includesAny(text, [
      "workout",
      "set",
      "weight",
      "exercise",
      "rep",
      "bicep",
      "tricep",
      "chest",
      "leg",
      "back",
      "shoulder",
    ]);
    const isGoalAction = includesAny(text, ["target", "goal"]);
    const actionTarget: HalkuActionTarget = isGoalAction
      ? "goal"
      : isWorkoutAction
        ? "workout"
        : "food";
    return { kind: "action_request", actionTarget };
  }
  if (includesAny(text, ["protein target", "protein goal", "why is my protein"])) {
    return { kind: "why_protein_target" };
  }
  if (includesAny(text, ["progress", "progression", "recommend"])) {
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

/**
 * Halku v1 has no write access to any table — it can only ever explain, never
 * perform, an action the user asks for. Answers honestly with the shortest
 * real path instead of a flat refusal, and never implies the action already
 * happened. Text is plain sentences + a numbered list, matching exactly what
 * HalkuMessageContent already renders (no new markup needed).
 */
function actionRequestAnswer(target: HalkuActionTarget): string {
  if (target === "workout") {
    return [
      "I can't log or change your workout data for you — I don't have write access yet. Here's the fastest way yourself:",
      "1. Open Workout.",
      "2. Log Workout (or Add set on an exercise you already logged).",
      "3. Enter the weight, reps and sets.",
      "4. Save.",
      "Want help with any of these steps?",
    ].join("\n");
  }
  if (target === "goal") {
    return [
      "I can't change your targets for you — here's the fastest way yourself:",
      "1. Open Settings.",
      "2. Find the target you want to change (e.g. protein).",
      "3. Enter the new value.",
      "4. Save.",
      "Want help with any of these steps?",
    ].join("\n");
  }
  return [
    "I can't add them for you yet. I can guide you through it:",
    "1. Open Food.",
    "2. Choose Today.",
    "3. Tap Add Meal.",
    "4. Add or review your meals.",
    "5. Save.",
    "Want me to guide you through it?",
  ].join("\n");
}

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
    case "define_equipment_field":
      return {
        grounded: false,
        text: 'Equipment is optional — it just narrows which exercise variants show up for that muscle group (e.g. barbell vs. dumbbell vs. machine), so you find the right one faster. Leave it as "Not specified" if you\'re not sure.',
      };
    case "how_to_log_homemade_food":
      return {
        grounded: false,
        text: 'Type what you made in the Food name field — e.g. "chicken curry with rice" — and the estimate is calculated from the description. You can also attach a photo or use the mic, and every number stays editable before you save.',
      };
    case "how_to_save_meal":
      return {
        grounded: false,
        text: "**Add Meal** → enter the food name and serving → review the estimated calories/macros (edit any of them if they're off) → **Save**. It's added to today's log immediately.",
      };
    case "how_to_add_set":
      return {
        grounded: false,
        text: "Tap **Add set** below that exercise's existing sets. The new set starts pre-filled with your last set's weight and rest time, so you usually only need to adjust reps.",
      };
    case "how_to_collapse_exercise":
      return {
        grounded: false,
        text: "Tap the exercise's own header (or the chevron next to it) to collapse or expand it. Collapsing just hides the sets from view — nothing you've entered is lost, and re-tapping brings it right back.",
      };
    case "fatigue_guidance":
      return {
        grounded: false,
        text: "Don't force a heavier weight through real fatigue — that's how form breaks down and injuries happen. Repeat the same weight this session instead, prioritize sleep and protein, and if you're still not recovering after a few sessions, treat it as a deload week (lighter load or a session or two off) rather than pushing through.",
      };
    case "action_request":
      return { grounded: false, text: actionRequestAnswer(intent.actionTarget ?? "food") };
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
