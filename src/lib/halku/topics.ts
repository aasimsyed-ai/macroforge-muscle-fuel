import type { HalkuAnchorId } from "./anchors";
import type { HalkuActionTarget } from "./respond";

/**
 * Common "how do I…" tasks and short glossary answers, kept as data so adding
 * one never touches the classifier's ordering. Steps mirror the real UI
 * labels (Add Meal, Log Workout, Settings, "Save workout", "Add exercise",
 * the Edit/Delete buttons on each meal). Halku cannot perform any of these
 * for the user — `actionTarget` marks the ones where a "can you do X for me"
 * phrasing must get the honest capability-limit answer instead.
 */
export interface HalkuTopic {
  id: string;
  triggers: readonly string[];
  text: string;
  actionTarget?: HalkuActionTarget;
  /** The control this topic is about — a seam for a future "show me" Guided Mode; unused today. */
  anchor?: HalkuAnchorId;
}

export const HALKU_TOPICS: readonly HalkuTopic[] = [
  {
    id: "log_workout",
    triggers: [
      "log a workout",
      "log workout",
      "record a workout",
      "start a workout",
      "add a workout",
      "create a workout",
      "track a workout",
    ],
    actionTarget: "workout",
    anchor: "nav.log-workout",
    text: [
      "### How to log a workout",
      "1. Open **Log Workout** (you'll need an account — guests can only track food).",
      "2. Pick a muscle group, then choose or search for an exercise (or type your own).",
      "3. Enter weight and reps for the set, then tap **Add set** for more.",
      "4. Tap **Add exercise** for the next movement.",
      "5. Tap **Save workout**.",
    ].join("\n"),
  },
  {
    id: "add_meal",
    triggers: [
      "add a meal",
      "log a meal",
      "log food",
      "add food",
      "log what i ate",
      "add my breakfast",
      "add my lunch",
      "add my dinner",
      "track a meal",
      "track my food",
    ],
    actionTarget: "food",
    anchor: "nav.add-meal",
    text: [
      "### How to add a meal",
      "1. Open **Add Meal**.",
      "2. Type what you ate (or use the mic, a photo, or **Scan barcode**).",
      "3. Tap **Estimate calories & macros** and check the numbers — every one is editable.",
      "4. Tap **Save meal**.",
    ].join("\n"),
  },
  {
    id: "edit_meal",
    triggers: [
      "edit a meal",
      "change a meal",
      "fix a meal",
      "edit my meal",
      "correct a meal",
      "edit a food",
    ],
    text: [
      "### How to edit a meal",
      "1. Open **Dashboard** and find the meal under **Meal history**.",
      "2. Tap the pencil (**Edit**) button on that meal.",
      "3. Change what you need and save.",
    ].join("\n"),
  },
  {
    id: "delete_meal",
    triggers: [
      "delete a meal",
      "remove a meal",
      "delete my meal",
      "delete a food",
      "remove a food",
    ],
    text: [
      "### How to delete a meal",
      "1. Open **Dashboard** and find the meal under **Meal history**.",
      "2. Tap the bin (**Delete**) button on that meal and confirm.",
      "Deleting can't be undone.",
    ].join("\n"),
  },
  {
    id: "add_exercise",
    triggers: [
      "add an exercise",
      "add another exercise",
      "add exercise",
      "new exercise",
      "custom exercise",
      "own exercise",
    ],
    anchor: "workout.add-exercise",
    text: [
      "### How to add an exercise",
      "1. In **Log Workout**, tap **Add exercise**.",
      "2. Search the list, or type your own exercise name.",
      "3. Add your sets with **Add set**.",
    ].join("\n"),
  },
  {
    id: "delete_exercise",
    triggers: [
      "delete an exercise",
      "remove an exercise",
      "delete exercise",
      "remove exercise",
      "delete a set",
      "remove a set",
      "delete set",
    ],
    text: [
      "### How to remove an exercise or set",
      "- **Exercise:** tap the **Remove exercise** (bin) button on that exercise's header.",
      "- **Set:** open the set and tap **Remove set**.",
      "The other exercises keep everything you've entered.",
    ].join("\n"),
  },
  {
    id: "change_target",
    triggers: [
      "change my calorie",
      "change my calories",
      "change calorie",
      "change my macro",
      "set my calorie",
      "set my target",
      "change my goal",
      "edit my target",
      "edit my goal",
      "change my daily target",
    ],
    actionTarget: "goal",
    anchor: "nav.settings",
    text: [
      "### How to change your targets",
      "1. Open **Settings**.",
      "2. Edit the values under **Daily targets** (calories, protein, carbs, fat…).",
      "3. Tap **Save targets**.",
    ].join("\n"),
  },
  {
    id: "voice",
    triggers: ["voice", "microphone", " mic ", "speak my food", "say what i ate"],
    anchor: "food.voice",
    text: [
      "### Adding food by voice",
      "1. In **Add Meal**, tap the mic in the Food name field.",
      "2. Say what you ate, e.g. “2 eggs and toast”.",
      "3. Tap **Estimate calories & macros** and review before saving.",
      "Voice depends on your browser and microphone permission.",
    ].join("\n"),
  },
  {
    id: "sign_up",
    triggers: ["sign up", "create an account", "create account", "register", "make an account"],
    text: "Tap **Sign up** at the top right (or on the landing page), enter your email and a password, then click the confirmation link we email you — you'll be signed in automatically. Anything you logged as a guest on this device is kept.",
  },
  {
    id: "log_out",
    triggers: ["log out", "logout", "sign out", "signout"],
    text: "Tap the **Sign out** icon in the top-right of the header.",
  },
  {
    id: "term_progressed",
    triggers: ["what does progressed", "progressed mean", "what is progressed"],
    text: "**Progressed** means that exercise beat your previous period on the same exercise — a heavier working weight, or more reps at the same weight, or more sets at the same weight and reps.",
  },
  {
    id: "term_maintained",
    triggers: ["what does maintained", "maintained mean", "what is maintained"],
    text: "**Maintained** means your weight, reps and sets matched the previous period. It's not a failure — it just means no new overload yet. Nudge weight or reps up next session.",
  },
  {
    id: "term_decreased",
    triggers: ["what does decreased", "decreased mean", "what is decreased", "needs work mean"],
    text: "**Decreased** means a lighter working weight (or fewer reps/sets at the same weight) than the previous period. A dip is normal — repeat last session's numbers, prioritise sleep and protein, and it usually recovers.",
  },
  {
    id: "term_no_data",
    triggers: ["not enough data", "insufficient data", "no data mean"],
    text: "**Not enough data** means there isn't a comparable session in the previous period yet (or nothing completed this period). Log a couple of sessions of the same exercise and it will compare them.",
  },
  {
    id: "deload",
    triggers: ["deload", "de-load"],
    text: "A **deload** is a planned easier week — lighter weights or fewer sets — so your body recovers before pushing again. Consider one if you've been stuck or fatigued for several sessions.",
  },
  {
    id: "term_frequent",
    triggers: ["what is frequent", "what does frequent", "frequent tab", "frequent foods"],
    text: "**Frequent**, in Add Meal, lists foods you log most often, ranked by how many times you've had them — tap one to log it again quickly.",
  },
  {
    id: "sets_reps_guidance",
    triggers: ["how many sets", "how many reps", "how many exercises", "how much weight should"],
    text: [
      "There's no single right answer, but a common starting point:",
      "- **Reps:** about 6–12 per set for muscle growth.",
      "- **Sets:** roughly 2–4 hard sets per exercise.",
      "- **Weight:** heavy enough that the last reps are tough with good form.",
      "Muscle Fuel tracks weight → reps at that weight → sets, so aim to beat last time in one of those.",
    ].join("\n"),
  },
  {
    id: "thanks",
    triggers: ["thanks", "thank you", "cheers"],
    text: "Anytime — ask me whenever you're unsure what to do next.",
  },
];

export function findTopic(text: string): HalkuTopic | undefined {
  return HALKU_TOPICS.find((topic) => topic.triggers.some((trigger) => text.includes(trigger)));
}

export function topicById(id: string): HalkuTopic | undefined {
  return HALKU_TOPICS.find((topic) => topic.id === id);
}
