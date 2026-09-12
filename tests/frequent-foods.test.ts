import { describe, expect, it } from "vitest";

import { rankFoodsByFrequency } from "../src/lib/data";

describe("rankFoodsByFrequency", () => {
  it("excludes a food split out of only one logged meal", () => {
    const names = ["banana", "chicken breast + rice"];
    expect(rankFoodsByFrequency(names, 8)).toHaveLength(0);
  });

  it("surfaces a food repeated across differently-worded meals (not whole meal combos)", () => {
    // The exact scenario from the phase 1 review: "2 eggs + toast" (x4),
    // "2 eggs + oats" (x3) and "3 eggs + spinach" (x2) never repeat as a
    // whole string, but "2 eggs" recurs across the first two.
    const names = [
      ...Array(4).fill("2 eggs + toast"),
      ...Array(3).fill("2 eggs + oats"),
      ...Array(2).fill("3 eggs + spinach"),
    ];
    const ranked = rankFoodsByFrequency(names, 8);
    const byName = new Map(ranked.map((f) => [f.name, f.count]));
    expect(byName.get("2 eggs")).toBe(7);
    expect(byName.get("toast")).toBe(4);
    expect(byName.get("oats")).toBe(3);
    expect(byName.get("3 eggs")).toBe(2);
    expect(byName.get("spinach")).toBe(2);
    // Never surfaces the whole combos as single entries.
    expect(byName.has("2 eggs + toast")).toBe(false);
  });

  it("is case-insensitive and trims whitespace when grouping", () => {
    const names = ["Banana", " banana ", "BANANA"];
    const ranked = rankFoodsByFrequency(names, 8);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.count).toBe(3);
  });

  it("ranks the most frequent food first", () => {
    const names = [...Array(5).fill("chicken breast"), ...Array(2).fill("banana")];
    const ranked = rankFoodsByFrequency(names, 8);
    expect(ranked[0]!.name).toBe("chicken breast");
  });

  it("respects the limit", () => {
    const names = [...Array(2).fill("a"), ...Array(2).fill("b"), ...Array(2).fill("c")];
    expect(rankFoodsByFrequency(names, 2)).toHaveLength(2);
  });
});
