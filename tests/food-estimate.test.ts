import { describe, expect, it } from "vitest";

import { referenceAnalyzer } from "../src/lib/food-estimate";

describe("referenceAnalyzer itemized breakdown", () => {
  it("returns exactly one item for a single food", async () => {
    const result = await referenceAnalyzer.analyze({ description: "banana", grams: null });
    expect(result).not.toBeNull();
    expect(result!.items).toBeDefined();
    expect(result!.items!.length).toBe(1);
    expect(result!.items![0]!.recognised).toBe(true);
  });

  it("splits a multi-item description into one item per food", async () => {
    const result = await referenceAnalyzer.analyze({
      description: "2 eggs + banana + rice",
      grams: null,
    });
    expect(result).not.toBeNull();
    expect(result!.items!.length).toBe(3);
  });

  it("item macros sum to the same totals reported at the top level", async () => {
    const result = await referenceAnalyzer.analyze({
      description: "chicken breast + rice + banana",
      grams: null,
    });
    expect(result).not.toBeNull();
    const items = result!.items!;
    const sum = items.reduce(
      (acc, it) => ({
        calories: acc.calories + it.calories,
        protein: acc.protein + it.protein,
        carbs: acc.carbs + it.carbs,
        fat: acc.fat + it.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    expect(sum.calories).toBe(result!.calories);
    expect(Math.round(sum.protein * 10) / 10).toBe(result!.protein);
    expect(Math.round(sum.carbs * 10) / 10).toBe(result!.carbs);
    expect(Math.round(sum.fat * 10) / 10).toBe(result!.fat);
  });

  it("marks an unrecognised item as not recognised without throwing", async () => {
    const result = await referenceAnalyzer.analyze({ description: "xyzfoodnotreal", grams: null });
    expect(result).not.toBeNull();
    expect(result!.items!.length).toBe(1);
    expect(result!.items![0]!.recognised).toBe(false);
  });
});
