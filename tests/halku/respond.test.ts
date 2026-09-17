import { describe, expect, it } from "vitest";

import {
  answerHalkuQuestionLocally,
  buildHalkuAnswer,
  classifyHalkuQuestion,
} from "../../src/lib/halku/respond";
import type { HalkuKnownData } from "../../src/lib/halku/types";

describe("classifyHalkuQuestion", () => {
  it.each([
    ["What does progressive overload mean?", "define_progressive_overload"],
    ["What are sets and reps?", "define_sets_reps"],
    ["How do I log homemade food?", "how_to_log_homemade_food"],
    ["Why is my protein target this amount?", "why_protein_target"],
    ["What should I enter for weight?", "define_weight_field"],
    ["Why did my progression change?", "why_progression_status"],
    ["Why didn't you recommend increasing my bicep weight?", "why_progression_status"],
    ["What does RPE mean?", "define_rir_rpe"],
    ["", "unknown"],
    ["What does this option do?", "unknown"],
    ["What does this do?", "unknown"],
    ["How do I add a set?", "how_to_add_set"],
    ["Can you add my today's meals to the food section?", "action_request"],
    ["Add my workout", "action_request"],
    ["Log my meal", "action_request"],
    ["Save this meal", "action_request"],
    ["Increase my bicep weight", "action_request"],
    ["Change my protein target", "action_request"],
    ["Why didn't you increase my bicep weight?", "why_progression_status"],
    ["How do I collapse an exercise?", "how_to_collapse_exercise"],
    ["What does Equipment do?", "define_equipment_field"],
    ["How do I save a meal?", "how_to_save_meal"],
    ["What should I do if I am too fatigued to increase the weight?", "fatigue_guidance"],
    ["What can you do?", "capabilities"],
    ["How can you help me?", "capabilities"],
    ["What are you for?", "capabilities"],
    ["What is Recent?", "define_recent_feature"],
    ["What are Saved meals?", "define_saved_meals_feature"],
    ["How do I scan a barcode?", "how_to_scan_barcode"],
    ["Am I progressing?", "why_progression_status"],
    ["What changed this week?", "why_progression_status"],
    ["How much protein did I eat today?", "personal_food_analysis"],
    ["What am I missing today?", "personal_food_analysis"],
    ["How am I doing against my calorie target?", "personal_food_analysis"],
    ["Where do I find my saved meals?", "where_to_find"],
    ["Where do I find Progress?", "where_to_find"],
  ])("classifies %j as %s", (question, expected) => {
    expect(classifyHalkuQuestion(question).kind).toBe(expected);
  });

  it("resolves a generic follow-up against the previous question", () => {
    const intent = classifyHalkuQuestion(
      "What should I do next?",
      "Why didn't you recommend increasing my bicep weight?",
    );
    expect(intent.kind).toBe("why_progression_status");
    expect(intent.muscleGroupHint).toBe("Biceps");
  });

  it("a generic follow-up with no previous question is unknown, not guessed", () => {
    expect(classifyHalkuQuestion("What should I do next?").kind).toBe("unknown");
  });

  it("tags where_to_find with the right navigation target", () => {
    expect(classifyHalkuQuestion("Where do I find my saved meals?").navigationTarget).toBe(
      "saved_meals",
    );
    expect(classifyHalkuQuestion("Where do I find Progress?").navigationTarget).toBe("progress");
    expect(classifyHalkuQuestion("Where do I find Log Workout?").navigationTarget).toBe("workout");
  });

  it("extracts a canonical muscle group from a free-text question", () => {
    const intent = classifyHalkuQuestion("Why didn't you recommend increasing my bicep weight?");
    expect(intent.muscleGroupHint).toBe("Biceps");
  });

  it("returns no muscle-group hint when none is named", () => {
    const intent = classifyHalkuQuestion("Why did my progression change?");
    expect(intent.muscleGroupHint).toBeUndefined();
  });

  it.each([
    ["Can you add my today's meals to the food section?", "food"],
    ["Add my workout", "workout"],
    ["Log my meal", "food"],
    ["Increase my bicep weight", "workout"],
    ["Change my protein target", "goal"],
  ])("tags %j with actionTarget %s", (question, expectedTarget) => {
    const intent = classifyHalkuQuestion(question);
    expect(intent.kind).toBe("action_request");
    expect(intent.actionTarget).toBe(expectedTarget);
  });
});

describe("buildHalkuAnswer — action requests are honest, never claim to have acted", () => {
  const empty: HalkuKnownData = {};

  it.each(["food", "workout", "goal"] as const)(
    "states the capability limit and gives real steps for actionTarget %s",
    (actionTarget) => {
      const answer = buildHalkuAnswer({ kind: "action_request", actionTarget }, empty);
      expect(answer.grounded).toBe(false);
      expect(answer.text.toLowerCase()).toContain("can't");
      // A numbered step list must actually be present.
      expect(answer.text).toMatch(/1\./);
      // Must never imply the action already happened.
      expect(answer.text.toLowerCase()).not.toContain("i've added");
      expect(answer.text.toLowerCase()).not.toContain("done!");
    },
  );

  it("gives concise, direct steps for adding a set", () => {
    const answer = buildHalkuAnswer({ kind: "how_to_add_set" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("add set");
  });

  it("explains how to collapse/expand an exercise and confirms data is preserved", () => {
    const answer = buildHalkuAnswer({ kind: "how_to_collapse_exercise" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("collapse");
    expect(answer.text.toLowerCase()).toContain("lost");
  });

  it("explains what the Equipment field does", () => {
    const answer = buildHalkuAnswer({ kind: "define_equipment_field" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("equipment");
  });

  it("gives direct steps for saving a meal, distinct from the homemade-specific answer", () => {
    const answer = buildHalkuAnswer({ kind: "how_to_save_meal" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("save");
  });

  it("gives real coaching guidance for fatigue, not a generic refusal", () => {
    const answer = buildHalkuAnswer({ kind: "fatigue_guidance" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).not.toContain("not confident");
    expect(answer.text.toLowerCase()).toContain("recover");
  });

  it("explains capabilities directly instead of the generic fallback", () => {
    const answer = buildHalkuAnswer({ kind: "capabilities" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).not.toContain("not confident");
    expect(answer.text.toLowerCase()).toContain("explain");
    expect(answer.text.toLowerCase()).toContain("can't");
  });

  it("explains the Recent feature by name", () => {
    const answer = buildHalkuAnswer({ kind: "define_recent_feature" }, empty);
    expect(answer.text.toLowerCase()).toContain("recent");
  });

  it("explains the Saved meals feature by name", () => {
    const answer = buildHalkuAnswer({ kind: "define_saved_meals_feature" }, empty);
    expect(answer.text.toLowerCase()).toContain("saved");
  });

  it("gives direct steps for scanning a barcode", () => {
    const answer = buildHalkuAnswer({ kind: "how_to_scan_barcode" }, empty);
    expect(answer.text.toLowerCase()).toContain("barcode");
  });

  it("points to a real screen for where_to_find with a resolved target", () => {
    const answer = buildHalkuAnswer(
      { kind: "where_to_find", navigationTarget: "saved_meals" },
      empty,
    );
    expect(answer.text).toContain("Saved");
  });

  it("asks a real clarifying question for where_to_find with no resolved target", () => {
    const answer = buildHalkuAnswer({ kind: "where_to_find" }, empty);
    expect(answer.text.toLowerCase()).toContain("which one");
  });
});

describe("buildHalkuAnswer — never fabricates data", () => {
  const empty: HalkuKnownData = {};

  it("a personal progression question with no data says so instead of inventing a number", () => {
    const answer = buildHalkuAnswer({ kind: "why_progression_status" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("enough");
  });

  it("a protein-target question with no goals data gives general guidance only", () => {
    const answer = buildHalkuAnswer({ kind: "why_protein_target" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text).not.toMatch(/\d/); // no fabricated number
  });

  it("an unknown question honestly declines rather than guessing", () => {
    const answer = buildHalkuAnswer({ kind: "unknown" }, empty);
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("not confident");
  });
});

describe("buildHalkuAnswer — grounds real data when available, labelled clearly", () => {
  it("uses the real protein target when goals data is supplied", () => {
    const data: HalkuKnownData = {
      today: { calories: 1800, proteinG: 90, calorieTarget: 2550, proteinTargetG: 130 },
    };
    const answer = buildHalkuAnswer({ kind: "why_protein_target" }, data);
    expect(answer.grounded).toBe(true);
    expect(answer.text).toContain("130 g");
    expect(answer.text.toLowerCase()).toContain("your data shows");
  });

  it("matches the named muscle group's own row, not a different one", () => {
    const data: HalkuKnownData = {
      progressRows: [
        {
          exerciseName: "Barbell Curl",
          muscleGroup: "Biceps",
          status: "maintained",
          explanation: "Same weight, reps and sets as last time.",
        },
        {
          exerciseName: "Barbell Squat",
          muscleGroup: "Legs",
          status: "progressed",
          explanation: "Working weight up 50 → 55 kg.",
        },
      ],
    };
    const answer = buildHalkuAnswer(
      { kind: "why_progression_status", muscleGroupHint: "Biceps" },
      data,
    );
    expect(answer.grounded).toBe(true);
    expect(answer.text).toContain("Barbell Curl");
    expect(answer.text).toContain("Maintained");
    expect(answer.text).not.toContain("Squat");
  });

  it("a progressed muscle group does not affect a different one's answer (no cross-muscle suppression)", () => {
    const data: HalkuKnownData = {
      progressRows: [
        {
          exerciseName: "Barbell Curl",
          muscleGroup: "Biceps",
          status: "progressed",
          explanation: "Working weight up 15 → 17.5 kg.",
        },
        {
          exerciseName: "Barbell Squat",
          muscleGroup: "Legs",
          status: "progressed",
          explanation: "Working weight up 50 → 55 kg.",
        },
      ],
    };
    const legs = buildHalkuAnswer(
      { kind: "why_progression_status", muscleGroupHint: "Legs" },
      data,
    );
    const biceps = buildHalkuAnswer(
      { kind: "why_progression_status", muscleGroupHint: "Biceps" },
      data,
    );
    expect(legs.text).toContain("Squat");
    expect(legs.text).toContain("Progressed");
    expect(biceps.text).toContain("Curl");
    expect(biceps.text).toContain("Progressed");
  });

  it("grounds a personal food analysis answer in today's real totals with a next step", () => {
    const data: HalkuKnownData = {
      today: { calories: 1800, proteinG: 90, calorieTarget: 2550, proteinTargetG: 130 },
    };
    const answer = buildHalkuAnswer({ kind: "personal_food_analysis" }, data);
    expect(answer.grounded).toBe(true);
    expect(answer.text).toContain("90");
    expect(answer.text).toContain("130");
    expect(answer.text).toContain("40"); // remaining protein
    expect(answer.text.toLowerCase()).toContain("halku's take");
  });

  it("a personal food analysis question with no today data says so honestly", () => {
    const answer = buildHalkuAnswer({ kind: "personal_food_analysis" }, {});
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("don't have enough");
  });

  it("a progression answer includes a concrete next-step recommendation, not just the status", () => {
    const data: HalkuKnownData = {
      progressRows: [
        {
          exerciseName: "Barbell Curl",
          muscleGroup: "Biceps",
          status: "maintained",
          explanation: "Same weight, reps and sets as last time.",
        },
      ],
    };
    const answer = buildHalkuAnswer(
      { kind: "why_progression_status", muscleGroupHint: "Biceps" },
      data,
    );
    expect(answer.text.toLowerCase()).toContain("halku's take");
    expect(answer.text.toLowerCase()).toContain("nudge");
  });

  it("falls back to an honest message when the named muscle group has no row yet", () => {
    const data: HalkuKnownData = {
      progressRows: [
        {
          exerciseName: "Barbell Squat",
          muscleGroup: "Legs",
          status: "progressed",
          explanation: "Working weight up 50 → 55 kg.",
        },
      ],
    };
    const answer = buildHalkuAnswer(
      { kind: "why_progression_status", muscleGroupHint: "Biceps" },
      data,
    );
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("couldn't match");
  });
});

describe("answerHalkuQuestionLocally", () => {
  it("classifies and answers in one step", () => {
    const answer = answerHalkuQuestionLocally("What are sets and reps?", {});
    expect(answer.grounded).toBe(false);
    expect(answer.text.toLowerCase()).toContain("rep");
  });
});
