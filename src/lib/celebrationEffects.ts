import { celebrationEffectsEnabled } from "./celebrationPreference";

/**
 * Short synthesized tones (Web Audio API) and a brief vibration — no external
 * audio files, no new dependency. Every export here silently no-ops unless
 * the user has explicitly turned celebration effects on in Settings, and
 * again no-ops on browsers without the relevant API. Never throws.
 */

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

function playTone(frequencies: number[], durationMs: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);

  const now = ctx.currentTime;
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.08;
    const end = start + durationMs / 1000;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  });
}

/** A quiet single-note confirmation — meals/workouts saved. */
export function playSaveTone() {
  if (!celebrationEffectsEnabled()) return;
  try {
    playTone([660], 150);
  } catch {
    // audio unsupported/blocked — silent no-op
  }
}

/** A brief three-note arpeggio — milestones and day-complete only. */
export function playMilestoneTone() {
  if (!celebrationEffectsEnabled()) return;
  try {
    playTone([523.25, 659.25, 783.99], 220);
  } catch {
    // audio unsupported/blocked — silent no-op
  }
}

export function triggerHaptic(pattern: number | number[] = 15) {
  if (!celebrationEffectsEnabled()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported — silent no-op
  }
}
