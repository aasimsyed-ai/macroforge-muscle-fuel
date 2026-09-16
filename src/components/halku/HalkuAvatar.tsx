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
 * The source PNGs have a solid black backdrop baked in (verified by
 * sampling pixels: fully opaque (0,0,0,255) for the masculine art; the
 * feminine art already has real alpha-transparent corners). `mix-blend-mode:
 * screen` looks like it solves this in isolation, but it doesn't actually
 * work on a genuinely opaque image — per the CSS Compositing spec, a
 * blended element composites against whatever has already been painted
 * *within its own stacking context*, not simply "the page behind it"; with
 * nothing else painted there first, an opaque black pixel has nothing to
 * blend with and paints as plain opaque black — reproduced live as a
 * visible black box specifically on the masculine asset (whose PNG has no
 * real transparency), while the feminine asset looked fine only because
 * its own alpha channel was already doing the work.
 *
 * The actual fix: an SVG luminance-key filter (`#halku-key-filter` below)
 * that recomputes each pixel's alpha from its own brightness — reading
 * only R/G/B, ignoring whatever alpha the source already had, so it works
 * identically for a fully-opaque PNG and one with real transparency. Truly
 * black pixels (the backdrop) become fully transparent; the character's
 * own colors (green skin, bright accents) stay opaque. This is a display-
 * time filter only — the PNG files themselves are never touched.
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
  const artSrc = HALKU_CHARACTER_ART[gender];
  if (artSrc) {
    return (
      <span className={cn("relative inline-block shrink-0", className)}>
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <filter id="halku-key-filter" colorInterpolationFilters="sRGB">
              {/* Keep R/G/B unchanged; alpha becomes each pixel's own
                  brightness (ignoring source alpha entirely), so a solid
                  black background — opaque or not — becomes transparent
                  while the character's own colors stay visible. */}
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  6 6 6 0 0" />
            </filter>
          </defs>
        </svg>
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
            src={artSrc}
            alt="Halku, personal AI trainer"
            className="size-full object-contain"
            style={{ filter: "url(#halku-key-filter)" }}
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
  const artSrc = HALKU_CHARACTER_ART[gender];
  if (!artSrc) return <HalkuAvatar gender={gender} {...(className ? { className } : {})} />;

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
