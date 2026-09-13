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
interface SpeechRecognitionErrorEventLike {
  /** e.g. "not-allowed", "no-speech", "network", "audio-capture". */
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
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

/** Chrome/Android/most desktop browsers support this, for free. Not iOS Safari. */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Wraps the browser's native speech recognition — no API key or backend of
 * our own involved (the browser vendor's own speech service does the
 * transcription; Chrome's typically sends audio to Google's servers rather
 * than running fully on-device). `onResult` fires once with the full
 * transcript when the user stops speaking (or taps stop); nothing is saved
 * or estimated here — the caller decides what to do with the text, same as
 * if the user had typed it. `onError` fires with the browser's error reason
 * (e.g. "not-allowed" for a denied mic permission) so the caller can show
 * the user something more useful than a mic icon that quietly turns off.
 */
export function useSpeechRecognition(
  onResult: (transcript: string) => void,
  onError?: (reason: string) => void,
) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Keeps the latest callbacks available inside the recognition instance's
  // event handlers without needing to recreate the instance when they change.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
    recognition.onerror = (event) => {
      setListening(false);
      onErrorRef.current?.(event.error);
    };
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
