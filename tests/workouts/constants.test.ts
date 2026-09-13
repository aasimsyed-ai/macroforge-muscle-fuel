import { describe, expect, it } from "vitest";

import { getEquipmentOptionsFor, getVariantOptionsFor } from "../../src/lib/workouts/constants";

describe("getEquipmentOptionsFor", () => {
  it("restricts to Bodyweight for a bodyweight exercise regardless of name", () => {
    expect(getEquipmentOptionsFor("Pull-Up", true)).toEqual(["Bodyweight"]);
  });

  it("narrows to a keyword found in the exercise's own name", () => {
    expect(getEquipmentOptionsFor("Seated Rowing Machine", false)).toEqual(["Machine"]);
    expect(getEquipmentOptionsFor("Cable Crossover", false)).toEqual(["Cable"]);
  });

  it("falls back to the full list for a name that doesn't name its own equipment", () => {
    // "Standing Lat Pulldown" is a machine/cable exercise in practice, but its
    // name doesn't say so — falling back (rather than guessing) is correct.
    const options = getEquipmentOptionsFor("Standing Lat Pulldown", false);
    expect(options.length).toBeGreaterThan(1);
  });

  it("falls back to the full list for a name with no equipment keyword", () => {
    const options = getEquipmentOptionsFor("Barbell Row", false);
    expect(options).toContain("Barbell");
    expect(options).toContain("EZ Bar");
  });

  it("falls back to the full list for names that don't name their own equipment", () => {
    const options = getEquipmentOptionsFor("Some New Exercise", false);
    expect(options.length).toBeGreaterThan(1);
  });
});

describe("getVariantOptionsFor", () => {
  it("restricts variants to the muscle group's relevant subset", () => {
    const options = getVariantOptionsFor("Biceps", "Barbell Curl");
    expect(options).not.toContain("Flat");
    expect(options).not.toContain("Incline");
    expect(options).toContain("Reverse-Grip");
  });

  it("drops a variant already implied by the exercise's own name", () => {
    const options = getVariantOptionsFor("Back", "Standing Lat Pulldown");
    expect(options).not.toContain("Standing");
  });

  it("drops a variant already implied by the exercise's own name (Seated)", () => {
    const options = getVariantOptionsFor("Back", "Seated Rowing Machine");
    expect(options).not.toContain("Seated");
  });

  it("falls back to the full variant list for an unlisted muscle group", () => {
    const options = getVariantOptionsFor("Other", "Some New Exercise");
    expect(options.length).toBeGreaterThan(5);
  });
});
