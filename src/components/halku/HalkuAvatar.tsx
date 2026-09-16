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
 * The source photos are full-body 2:3 portraits, so a plain <img> squashed
 * into a small square/circle would barely show a face. Instead this crops
 * with `object-fit: cover` + `object-position: top` inside a clipped,
 * `className`-sized frame — anchoring to the top of the source image always
 * surfaces the head and shoulders first, staying recognizable down to the
 * smallest (floating-launcher) size, and revealing a bit more of the
 * branded outfit at larger sizes (e.g. the chat panel header) without ever
 * needing a different crop per call site.
 */
export function HalkuAvatar({ gender, className }: { gender: HalkuGender; className?: string }) {
  const artSrc = HALKU_CHARACTER_ART[gender];
  if (artSrc) {
    return (
      <span
        className={cn("relative inline-block overflow-hidden rounded-full bg-black/80", className)}
      >
        <img
          src={artSrc}
          alt="Halku, personal AI trainer"
          className="size-full object-cover object-top"
        />
      </span>
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
