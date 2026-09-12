import { describe, expect, it } from "vitest";

import { rankMealsByFrequency, type FrequentMealSourceRow } from "../src/lib/data";

function row(name: string, calories: number): FrequentMealSourceRow {
  return {
    name,
    category: "lunch",
    serving_amount: null,
    calories,
    protein_g: 10,
    carbs_g: 10,
    fat_g: 10,
    is_estimate: false,
    estimate_source: null,
  };
}

describe("rankMealsByFrequency", () => {
  it("excludes foods logged only once", () => {
    const rows = [row("Banana", 90), row("Chicken rice", 500)];
    expect(rankMealsByFrequency(rows, 8)).toHaveLength(0);
  });

  it("ranks foods logged more often first", () => {
    const rows = [
      row("Banana", 90),
      row("Chicken rice", 500),
      row("Banana", 90),
      row("Chicken rice", 500),
      row("Chicken rice", 500),
    ];
    const ranked = rankMealsByFrequency(rows, 8);
    expect(ranked.map((m) => m.name)).toEqual(["Chicken rice", "Banana"]);
  });

  it("is case-insensitive when grouping by name", () => {
    const rows = [row("banana", 90), row("Banana", 95), row("BANANA", 100)];
    const ranked = rankMealsByFrequency(rows, 8);
    expect(ranked).toHaveLength(1);
  });

  it("keeps the most recent (first) row's macros for each group", () => {
    const rows = [
      { ...row("Oats", 300) },
      { ...row("Oats", 250) },
    ];
    const ranked = rankMealsByFrequency(rows, 8);
    expect(ranked[0]!.calories).toBe(300);
  });

  it("respects the limit", () => {
    const rows = [
      row("A", 1), row("A", 1),
      row("B", 1), row("B", 1),
      row("C", 1), row("C", 1),
    ];
    expect(rankMealsByFrequency(rows, 2)).toHaveLength(2);
  });
});
