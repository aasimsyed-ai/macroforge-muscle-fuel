import { describe, expect, it } from "vitest";

import {
  aggregateDailyProtein,
  computeLoggingStreak,
  computeProteinStreak,
  countProteinHitDays,
} from "../src/lib/streaks";

const NOW = new Date("2026-09-12T18:00:00");

function meal(dateIso: string, protein: number) {
  return { eaten_at: `${dateIso}T12:00:00`, protein_g: protein };
}

describe("aggregateDailyProtein", () => {
  it("sums protein per local day and marks the day as logged", () => {
    const totals = aggregateDailyProtein([
      meal("2026-09-11", 40),
      meal("2026-09-11", 30),
      meal("2026-09-12", 20),
    ]);
    expect(totals.get("2026-09-11")).toEqual({ hasMeal: true, protein: 70 });
    expect(totals.get("2026-09-12")).toEqual({ hasMeal: true, protein: 20 });
    expect(totals.has("2026-09-10")).toBe(false);
  });
});

describe("computeLoggingStreak", () => {
  it("counts consecutive days ending today", () => {
    const totals = aggregateDailyProtein([
      meal("2026-09-10", 50),
      meal("2026-09-11", 50),
      meal("2026-09-12", 50),
    ]);
    expect(computeLoggingStreak(totals, NOW)).toBe(3);
  });

  it("stays alive if yesterday was logged but today has nothing yet", () => {
    const totals = aggregateDailyProtein([meal("2026-09-10", 50), meal("2026-09-11", 50)]);
    expect(computeLoggingStreak(totals, NOW)).toBe(2);
  });

  it("breaks on a skipped day", () => {
    const totals = aggregateDailyProtein([meal("2026-09-08", 50), meal("2026-09-12", 50)]);
    expect(computeLoggingStreak(totals, NOW)).toBe(1);
  });

  it("is zero with no recent history", () => {
    const totals = aggregateDailyProtein([meal("2026-08-01", 50)]);
    expect(computeLoggingStreak(totals, NOW)).toBe(0);
  });
});

describe("computeProteinStreak", () => {
  it("only counts days that actually met the target", () => {
    const totals = aggregateDailyProtein([
      meal("2026-09-10", 130),
      meal("2026-09-11", 90), // under target
      meal("2026-09-12", 140),
    ]);
    expect(computeProteinStreak(totals, 130, NOW)).toBe(1);
  });

  it("returns 0 for a non-positive target", () => {
    const totals = aggregateDailyProtein([meal("2026-09-12", 200)]);
    expect(computeProteinStreak(totals, 0, NOW)).toBe(0);
  });
});

describe("countProteinHitDays", () => {
  it("counts every qualifying day in the window, not just a streak", () => {
    const totals = aggregateDailyProtein([
      meal("2026-08-01", 140),
      meal("2026-08-15", 90), // under target
      meal("2026-09-01", 200),
      meal("2026-09-12", 130),
    ]);
    expect(countProteinHitDays(totals, 130)).toBe(3);
  });

  it("returns 0 for a non-positive target", () => {
    const totals = aggregateDailyProtein([meal("2026-09-12", 200)]);
    expect(countProteinHitDays(totals, 0)).toBe(0);
  });
});
