import { useCallback, useEffect, useState } from "react";

export type TrackingMode = "food" | "workout";

/**
 * Persisted with the localStorage key named in the feature spec. The app has no
 * global client-state store, and mode is a per-device preference rather than a
 * shareable URL parameter, so localStorage is the right fit here.
 */
const STORAGE_KEY = "macroforge-tracking-mode";

function readMode(): TrackingMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "workout" ? "workout" : "food";
  } catch {
    return "food";
  }
}

export function useTrackingMode(): [TrackingMode, (mode: TrackingMode) => void] {
  // Start as "food" so SSR and the first client render agree; correct in effect.
  const [mode, setModeState] = useState<TrackingMode>("food");

  useEffect(() => {
    setModeState(readMode());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setModeState(readMode());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((next: TrackingMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — keep the in-memory value
    }
  }, []);

  return [mode, setMode];
}
