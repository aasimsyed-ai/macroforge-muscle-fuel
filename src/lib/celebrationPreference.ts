import { useCallback, useEffect, useState } from "react";

/**
 * Sound + haptic feedback on save/milestones — a per-device preference, off by
 * default. Mirrors the pattern already used for tracking mode: localStorage,
 * not a database column, since this has nothing to do with account data.
 */
const STORAGE_KEY = "macroforge-celebration-fx";

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useCelebrationPreference(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    setEnabledState(readEnabled());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setEnabledState(readEnabled());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable — keep the in-memory value for this session
    }
  }, []);

  return [enabled, setEnabled];
}

/** One-off read for non-component call sites (e.g. right before firing an effect). */
export function celebrationEffectsEnabled(): boolean {
  return readEnabled();
}
