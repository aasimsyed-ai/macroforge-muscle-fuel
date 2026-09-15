import { useEffect, useRef, useState } from "react";
import { Loader2, ScanLine } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { lookupBarcodeProduct } from "@/lib/barcodeLookup";
import type { EstimatedItem } from "@/lib/food-estimate";

/**
 * Minimal shape of the native BarcodeDetector API — not part of
 * TypeScript's standard DOM lib, hand-typed like useSpeechRecognition's
 * SpeechRecognition shape.
 */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
}

function getBarcodeDetectorCtor():
  (new (opts: { formats: string[] }) => BarcodeDetectorLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  };
  return w.BarcodeDetector ?? null;
}

/** Chrome/Edge/Android — not Safari/iOS/Firefox as of this writing. Always feature-detect before offering this. */
export function isBarcodeScanningSupported(): boolean {
  return getBarcodeDetectorCtor() !== null;
}

type ScanState = "starting" | "scanning" | "looking-up" | "not-found" | "camera-error";

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (item: EstimatedItem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>("starting");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frameHandle: number | null = null;
    let notFoundTimeout: number | null = null;
    setState("starting");

    async function run() {
      const Ctor = getBarcodeDetectorCtor();
      if (!Ctor) {
        setState("camera-error");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        if (!cancelled) setState("camera-error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (cancelled) return;
      setState("scanning");

      const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });

      const scanFrame = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const code = results[0]?.rawValue;
          if (code) {
            setState("looking-up");
            const item = await lookupBarcodeProduct(code);
            if (cancelled) return;
            if (item) {
              onDetected(item);
              onOpenChange(false);
              return;
            }
            // Not found: show it briefly, then keep scanning automatically
            // rather than dead-ending the dialog — the user can just point
            // the camera at a different product without closing/reopening.
            setState("not-found");
            notFoundTimeout = window.setTimeout(() => {
              if (cancelled) return;
              setState("scanning");
              frameHandle = window.requestAnimationFrame(() => void scanFrame());
            }, 2000);
            return;
          }
        } catch {
          // a single failed detection attempt isn't fatal — keep scanning
        }
        frameHandle = window.requestAnimationFrame(() => void scanFrame());
      };
      frameHandle = window.requestAnimationFrame(() => void scanFrame());
    }

    void run();

    return () => {
      cancelled = true;
      if (frameHandle !== null) window.cancelAnimationFrame(frameHandle);
      if (notFoundTimeout !== null) window.clearTimeout(notFoundTimeout);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan a barcode</DialogTitle>
          <DialogDescription>
            {state === "not-found"
              ? "Couldn't find that product — try again or add it manually."
              : state === "camera-error"
                ? "Couldn't access the camera — you can still add this manually."
                : "Point the camera at the barcode."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary">
          <video ref={videoRef} muted playsInline className="size-full object-cover" />
          {state === "scanning" ? (
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-primary/70" />
          ) : null}
          {state === "starting" || state === "looking-up" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : null}
          {state === "camera-error" ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <ScanLine className="size-8 text-muted-foreground" aria-hidden="true" />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
