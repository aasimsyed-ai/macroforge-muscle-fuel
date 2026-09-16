import type { HalkuGender } from "@/lib/halku/types";
import { cn } from "@/lib/utils";
import { HALKU_CHARACTER_ART } from "./halkuAssets";

/**
 * Halku's visual mark. Renders the approved character photo from
 * `halkuAssets.ts` whenever one is set for the given gender — the real
 * artwork is the product identity now, never the placeholder, as long as an
 * asset path exists. Falls through to the abstract SVG below only if a path
 * is `null` (e.g. a future gender variant without art yet).
 *
 * The source photos are full-body 2:3 portraits. A plain `object-fit: cover`
 * crop of a full-body shot into a small circle would show mostly torso, not
 * a face — barely recognizable at launcher size. Instead this renders the
 * art as a `background-image` zoomed in on the head: `background-size` is
 * set well past 100% (280%) so only roughly the top fifth of the source
 * image — head, hair and collar — fills the frame, with `background-
 * position: 50% 0%` keeping it centered and anchored to the top. Same crop
 * everywhere HalkuAvatar is used (launcher, chat header, quick guide) for a
 * consistent, recognizable "headshot" at every size — no per-call-site
 * tuning, and the source files themselves are never resized or edited.
 */
export function HalkuAvatar({ gender, className }: { gender: HalkuGender; className?: string }) {
  const artSrc = HALKU_CHARACTER_ART[gender];
  if (artSrc) {
    return (
      <span
        role="img"
        aria-label="Halku, personal AI trainer"
        className={cn("inline-block shrink-0 overflow-hidden rounded-full bg-black/80", className)}
        style={{
          backgroundImage: `url(${artSrc})`,
          backgroundSize: "280% auto",
          backgroundPosition: "50% 0%",
          backgroundRepeat: "no-repeat",
        }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Halku, personal AI trainer"
    >
      <circle cx="24" cy="24" r="23" fill="var(--primary)" opacity="0.15" />
      {/* shoulders */}
      <path
        d="M10 38c0-8 6-13 14-13s14 5 14 13"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* head */}
      <circle cx="24" cy="18" r="8" fill="var(--primary)" />
      {gender === "feminine" ? (
        <path
          d="M17 14c0-2 3-3 7-3s7 1 7 3v3c-2-2-4-3-7-3s-5 1-7 3z"
          fill="var(--primary)"
          opacity="0.6"
        />
      ) : (
        <path
          d="M17 13c2-1.5 4.5-2 7-2s5 0.5 7 2l-1 2c-2-1-4-1.5-6-1.5s-4 0.5-6 1.5z"
          fill="var(--primary)"
          opacity="0.6"
        />
      )}
      {/* small spark accent, echoing the app's own Flame mark */}
      <path d="M32 30l2-4 2 4-2 1.5z" fill="var(--primary)" />
    </svg>
  );
}
