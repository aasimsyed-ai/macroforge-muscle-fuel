import type { HalkuGender } from "./types";

const GENDER_KEY = "macroforge-halku-gender";

export function getHalkuGender(): HalkuGender {
  try {
    const raw = localStorage.getItem(GENDER_KEY);
    return raw === "feminine" ? "feminine" : "masculine";
  } catch {
    return "masculine";
  }
}

export function setHalkuGender(gender: HalkuGender): void {
  try {
    localStorage.setItem(GENDER_KEY, gender);
  } catch {
    // ignore — falls back to the default next load
  }
}
