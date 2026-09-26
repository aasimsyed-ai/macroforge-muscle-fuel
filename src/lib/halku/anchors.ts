/**
 * Stable names for the controls Halku may one day point at ("Guided Mode":
 * "Show me how to add a set" → highlight the button, explain, demonstrate).
 *
 * This is only the seam — a registry plus a `data-halku-anchor` attribute on the
 * real controls. Nothing here highlights, animates or navigates yet; a future
 * spotlight component can look an anchor up with `findAnchorElement` and draw a
 * ring around it. See docs/halku-guidance-architecture.md.
 *
 * Adding an anchor: add it here, put `{...anchorProps("section.name")}` on the
 * control, and (optionally) set `anchor` on the matching topic in topics.ts.
 * A test keeps this list and the attributes in the source in lock-step.
 */
export const HALKU_ANCHORS = [
  { id: "nav.dashboard", route: null, label: "Dashboard tab" },
  { id: "nav.add-meal", route: null, label: "Add Meal tab" },
  { id: "nav.log-workout", route: null, label: "Log Workout tab" },
  { id: "nav.settings", route: null, label: "Settings tab" },
  { id: "food.name-field", route: "/add-meal", label: "Food name field" },
  { id: "food.voice", route: "/add-meal", label: "Voice input button" },
  { id: "food.scan-barcode", route: "/add-meal", label: "Scan barcode button" },
  { id: "food.estimate", route: "/add-meal", label: "Estimate calories & macros button" },
  { id: "food.save-meal", route: "/add-meal", label: "Save meal button" },
  { id: "workout.copy-previous", route: "/log-workout", label: "Copy from a previous workout" },
  { id: "workout.add-exercise", route: "/log-workout", label: "Add exercise button" },
  { id: "workout.add-set", route: "/log-workout", label: "Add set button" },
  { id: "workout.save", route: "/log-workout", label: "Save workout button" },
  { id: "progress.board", route: "/dashboard", label: "Progressive-overload board" },
] as const;

export type HalkuAnchorId = (typeof HALKU_ANCHORS)[number]["id"];

/** Spread onto a control: `<Button {...anchorProps("workout.add-set")} />`. */
export function anchorProps(id: HalkuAnchorId): { "data-halku-anchor": HalkuAnchorId } {
  return { "data-halku-anchor": id };
}

/** The route an anchor lives on, or null when it is in the app shell on every page. */
export function anchorRoute(id: HalkuAnchorId): string | null {
  return HALKU_ANCHORS.find((anchor) => anchor.id === id)?.route ?? null;
}

/**
 * The first VISIBLE element for an anchor (the nav exists twice — desktop and
 * mobile — and only one is shown), or null when it isn't on the page. Callers
 * must treat null as "not here" rather than an error.
 */
export function findAnchorElement(
  id: HalkuAnchorId,
  root: ParentNode | null = typeof document !== "undefined" ? document : null,
): HTMLElement | null {
  if (!root) return null;
  const matches = root.querySelectorAll<HTMLElement>(`[data-halku-anchor="${id}"]`);
  for (const element of matches) {
    if (element.getClientRects().length > 0) return element;
  }
  return null;
}
