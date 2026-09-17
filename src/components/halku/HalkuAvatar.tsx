import type { HalkuGender } from "@/lib/halku/types";
import { cn } from "@/lib/utils";
import { HALKU_CHARACTER_ART } from "./halkuAssets";

/**
 * Halku's future emotional states (see docs/halku-guidance-architecture.md).
 * Only "neutral" has approved art today — every other state still renders
 * the same neutral asset. This prop exists so call sites can already say
 * *what* Halku is doing (thinking, celebrating, guiding…) without waiting
 * for the art; swapping in real per-state images later is then a change to
 * `halkuAssets.ts` alone, not to any consumer.
 */
export type HalkuGuidanceState =
  "idle" | "thinking" | "explaining" | "encouraging" | "celebrating" | "concerned" | "guiding";

/**
 * Halku's visual mark — a free-standing character, not a photo in a card.
 * The masculine PNG has a solid black backdrop baked in with no real alpha
 * at all (verified by sampling pixels: fully opaque (0,0,0,255) everywhere
 * outside the figure). An SVG luminance-key filter (`#halku-key-filter`
 * below) fakes transparency for it at display time: it recomputes each
 * pixel's alpha from its own brightness, so truly black background pixels
 * become transparent while the character's own colors stay opaque. The
 * PNG file itself is never touched.
 *
 * The feminine PNG is different — it already has real, if hard-edged
 * (unfeathered), alpha transparency baked in by whatever produced it.
 * Running the same luminance filter on top of that real alpha was actively
 * harmful, not merely redundant: it re-derives a *second*, differently-
 * shaped alpha boundary from raw brightness on top of the cutout that's
 * already there, and the two disagreeing edges is what produced a reported
 * pixelated/scattered/haloed appearance — verified by sampling the source
 * file directly, which has a clean (if abrupt) transparency edge and looks
 * sharp when rendered plainly, before any of this component's processing.
 * So the filter is applied conditionally, per `halkuAssets.ts`'s
 * `needsBlackKeyFilter` (sampled per-file, not guessed): true for the
 * masculine asset, false for the feminine one, which renders through its
 * own real alpha untouched.
 *
 * `object-fit: contain` keeps the full figure — head to feet — intact at
 * any container size, no cropping.
 *
 * `interactive` adds the idle "alive" motion, hover/press reaction, and a
 * soft blurred glow (a separate blob behind the character, never a hard-
 * edged ring/border) used for the floating launcher; other call sites
 * (chat header, Quick Guide) use `HalkuHeadshot` instead, unaffected by any
 * of this. Both animations respect `prefers-reduced-motion`, and live on a
 * wrapper `<span>` rather than the filtered `<img>` itself — an animated
 * `transform` directly on a filtered/blended element risks the same "loses
 * its real backdrop" class of bug the SVG filter approach otherwise avoids
 * (reproduced once already with the blend-mode attempt; kept this
 * separation as a precaution since it costs nothing).
 *
 * The hover/press reaction is a brief rotation-and-settle "lean in and nod"
 * (`halku-greet`, `transform-origin: bottom` so the character pivots from
 * its own feet) rather than a scale change — scaling a photographed figure
 * up or down reads as "the image got bigger," not as a gesture, and a
 * non-uniform scale would visibly distort anatomy. Rotation preserves the
 * character's proportions exactly while still reading as a deliberate,
 * subtle acknowledgement. There's no second art asset for an actual arm
 * wave/thumbs-up pose — see docs/halku-guidance-architecture.md for that as
 * a documented future asset need, not faked here with a distorting
 * transform.
 */
export function HalkuAvatar({
  gender,
  className,
  interactive = false,
}: {
  gender: HalkuGender;
  className?: string;
  interactive?: boolean;
}) {
  const art = HALKU_CHARACTER_ART[gender];
  if (art) {
    return (
      <span className={cn("relative inline-block shrink-0", className)}>
        {art.needsBlackKeyFilter ? (
          <svg width="0" height="0" className="absolute" aria-hidden="true">
            <defs>
              <filter id="halku-key-filter" colorInterpolationFilters="sRGB">
                {/* Keep R/G/B unchanged; alpha becomes each pixel's own
                    brightness (ignoring source alpha entirely), so a solid
                    black background — opaque, no real alpha channel at
                    all — becomes transparent while the character's own
                    colors stay visible. Only used for art that actually
                    needs it (see this file's top doc comment). */}
                <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  6 6 6 0 0" />
              </filter>
            </defs>
          </svg>
        ) : null}
        {interactive ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-[10%] inset-y-[15%] -z-10 rounded-full bg-primary/0 blur-2xl transition-colors duration-300 group-hover:bg-primary/25"
          />
        ) : null}
        <span
          className={cn(
            "block size-full origin-bottom",
            interactive &&
              "motion-safe:animate-[halku-breathe_4.5s_ease-in-out_infinite] motion-safe:group-hover:animate-[halku-greet_0.6s_ease-out_forwards] motion-safe:group-active:animate-[halku-greet_0.45s_ease-out_forwards]",
          )}
        >
          <img
            src={art.src}
            alt="Halku, personal AI trainer"
            className="size-full object-contain"
            style={art.needsBlackKeyFilter ? { filter: "url(#halku-key-filter)" } : undefined}
          />
        </span>
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

/**
 * Small, tightly-cropped variant for contexts that genuinely want a round
 * headshot badge instead of the standing character (chat header, Quick
 * Guide) — zooms into the top ~22% of the same source art via
 * `background-size`, since a plain `cover` crop of a full-body photo into a
 * circle shows mostly torso, not a recognizable face.
 */
export function HalkuHeadshot({ gender, className }: { gender: HalkuGender; className?: string }) {
  const art = HALKU_CHARACTER_ART[gender];
  if (!art) return <HalkuAvatar gender={gender} {...(className ? { className } : {})} />;

  return (
    <span
      role="img"
      aria-label="Halku, personal AI trainer"
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full border border-primary/30 bg-secondary",
        className,
      )}
    >
      {/* Same conditional luminance-key filter as the standing HalkuAvatar
          above, and for the same reason: applying it to the feminine art
          (which already has real alpha) reproduces the pixelated/haloed
          look this component's own history already fixed once. */}
      <img
        src={art.src}
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-auto w-[280%] max-w-none -translate-x-1/2 object-contain"
        style={art.needsBlackKeyFilter ? { filter: "url(#halku-key-filter)" } : undefined}
      />
    </span>
  );
}
