import { useCallback, useRef, useState } from "react";

/**
 * Brief "just saved" flag for a tasteful checkmark flourish on a save button.
 * Purely visual, not persisted — call `celebrate()` right after a successful save.
 */
export function useSaveFeedback(durationMs = 1100) {
  const [justSaved, setJustSaved] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const celebrate = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setJustSaved(true);
    timeoutRef.current = window.setTimeout(() => setJustSaved(false), durationMs);
  }, [durationMs]);

  return [justSaved, celebrate] as const;
}
