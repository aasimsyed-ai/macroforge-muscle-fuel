/**
 * First-time contextual guidance per major section — deliberately separate
 * from the app-wide first-run intro (`onboarding.ts`/`OnboardingIntro.tsx`),
 * which is a one-time "welcome to the app" wizard shown once, ever. These are
 * short glossaries shown the first time a user opens *this particular*
 * section, and stay reachable afterwards via a "?" button — not a tutorial,
 * not multi-step, just "what do these controls mean and what do I do first."
 * Same per-device localStorage-flag pattern as onboarding.ts, one flag per
 * section so each is independent.
 */

export type GuideSectionId = "food" | "workout" | "progress";

export interface GuideTerm {
  term: string;
  meaning: string;
}

export interface SectionGuideContent {
  title: string;
  intro: string;
  terms: GuideTerm[];
  firstStep: string;
}

export const SECTION_GUIDES: Record<GuideSectionId, SectionGuideContent> = {
  food: {
    title: "Food tracking",
    intro: "Log what you eat and see calories and macros against your daily targets.",
    terms: [
      { term: "Recent", meaning: "Meals you've logged recently — tap one to log it again." },
      {
        term: "Frequent",
        meaning: "Foods you log often, ranked by how many times you've had them.",
      },
      { term: "Saved", meaning: "Meals you've explicitly saved for one-tap reuse later." },
      { term: "Voice", meaning: "Tap the mic and describe what you ate instead of typing it." },
      { term: "Barcode", meaning: "Scan a packaged food's barcode for its exact label nutrition." },
      {
        term: "Nutrition review",
        meaning:
          "Check and correct the estimated calories/macros before you save — nothing saves without your OK.",
      },
    ],
    firstStep: "Type or say what you ate, review the estimate, then save.",
  },
  workout: {
    title: "Workout tracking",
    intro: "Log your sets so the app can tell you whether you're actually progressing over time.",
    terms: [
      { term: "Exercise", meaning: "What you're training — search the list or type your own." },
      {
        term: "Equipment",
        meaning: "Narrows the exercise/variant options to what's actually relevant.",
      },
      { term: "Weight", meaning: "The load you lifted for that set, in kg." },
      { term: "Reps", meaning: "How many repetitions you completed in that set." },
      { term: "Sets", meaning: "How many working sets you performed for that exercise." },
      {
        term: "Rest",
        meaning: "How long you rested afterwards, in seconds — defaults to 60s, editable.",
      },
      {
        term: "Expand / collapse",
        meaning: "Tap an exercise's header to show or hide its sets and keep the screen compact.",
      },
      {
        term: "Progressive overload",
        meaning:
          "Whether this session beat your last comparable one — more weight, more reps, or more sets.",
      },
    ],
    firstStep: "Pick a muscle group and exercise, log your sets, then save the workout.",
  },
  progress: {
    title: "Progress",
    intro: "See whether you're actually progressively overloading, exercise by exercise.",
    terms: [
      { term: "This week", meaning: "Your current week's performance, compared to last week." },
      { term: "Last week", meaning: "Last week's performance, compared to the week before it." },
      { term: "This month", meaning: "A longer-term view — this month so far vs. last month." },
      {
        term: "Muscle / exercise progression",
        meaning:
          "Each exercise is judged on its own: Progressed, Maintained, Decreased, or Not enough data yet — never a single overall score.",
      },
    ],
    firstStep: "Log a couple of comparable sessions for an exercise, then check back here.",
  },
};

function storageKey(section: GuideSectionId): string {
  return `macroforge-guide-seen:${section}`;
}

export function hasSeenSectionGuide(section: GuideSectionId): boolean {
  try {
    return localStorage.getItem(storageKey(section)) === "1";
  } catch {
    return true;
  }
}

export function markSectionGuideSeen(section: GuideSectionId): void {
  try {
    localStorage.setItem(storageKey(section), "1");
  } catch {
    // ignore — worst case the guide reappears next visit on this device
  }
}
