import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal shape of the browser's native Web Speech API — not part of
 * TypeScript's standard DOM lib (it's non-standard/experimental), so this
 * is hand-typed rather than relying on ambient globals that may not exist
 * in this project's configured lib.
 */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Chrome/Android/most desktop browsers support this on-device, for free. Not iOS Safari. */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Wraps the browser's native, on-device speech recognition — no server
 * call, no cost, no credential. `onResult` fires once with the full
 * transcript when the user stops speaking (or taps stop); nothing is
 * saved or estimated here — the caller decides what to do with the text,
 * same as if the user had typed it.
 */
export function useSpeechRecognition(onResult: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Keeps the latest callback available inside the recognition instance's
  // event handlers without needing to recreate the instance when it changes.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onResultRef.current(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, start, stop, supported: isSpeechRecognitionSupported() };
}
