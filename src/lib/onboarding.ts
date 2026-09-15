/**
 * Whether this device has already seen (or skipped) the first-run intro.
 * A per-device flag, not an account attribute — deliberately separate from
 * `profiles.onboarded` (which tracks whether the profile form was filled
 * in) since "has seen the intro" and "has set up their profile" are
 * unrelated facts. Works identically for guests and signed-in users.
 */
const ONBOARDING_KEY = "macroforge-onboarding-seen";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    // storage unavailable — don't repeatedly interrupt over it
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // ignore — worst case the intro reappears next visit on this device
  }
}
