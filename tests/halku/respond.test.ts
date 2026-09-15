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
  ])("classifies %j as %s", (question, expected) => {
    expect(classifyHalkuQuestion(question).kind).toBe(expected);
  });

  it("extracts a canonical muscle group from a free-text question", () => {
    const intent = classifyHalkuQuestion("Why didn't you recommend increasing my bicep weight?");
    expect(intent.muscleGroupHint).toBe("Biceps");
  });

  it("returns no muscle-group hint when none is named", () => {
    const intent = classifyHalkuQuestion("Why did my progression change?");
    expect(intent.muscleGroupHint).toBeUndefined();
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
        { exerciseName: "Barbell Curl", muscleGroup: "Biceps", status: "maintained", explanation: "Same weight, reps and sets as last time." },
        { exerciseName: "Barbell Squat", muscleGroup: "Legs", status: "progressed", explanation: "Working weight up 50 → 55 kg." },
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
        { exerciseName: "Barbell Curl", muscleGroup: "Biceps", status: "progressed", explanation: "Working weight up 15 → 17.5 kg." },
        { exerciseName: "Barbell Squat", muscleGroup: "Legs", status: "progressed", explanation: "Working weight up 50 → 55 kg." },
      ],
    };
    const legs = buildHalkuAnswer({ kind: "why_progression_status", muscleGroupHint: "Legs" }, data);
    const biceps = buildHalkuAnswer({ kind: "why_progression_status", muscleGroupHint: "Biceps" }, data);
    expect(legs.text).toContain("Squat");
    expect(legs.text).toContain("Progressed");
    expect(biceps.text).toContain("Curl");
    expect(biceps.text).toContain("Progressed");
  });

  it("falls back to an honest message when the named muscle group has no row yet", () => {
    const data: HalkuKnownData = {
      progressRows: [
        { exerciseName: "Barbell Squat", muscleGroup: "Legs", status: "progressed", explanation: "Working weight up 50 → 55 kg." },
      ],
    };
    const answer = buildHalkuAnswer({ kind: "why_progression_status", muscleGroupHint: "Biceps" }, data);
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
