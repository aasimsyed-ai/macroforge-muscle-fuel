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
 * Halku's visual mark — a compact standing character, not a passport-photo
 * headshot. The source art is a full-body 2:3 portrait; the avatar's own
 * container is sized to that same 2:3 ratio (see the `w-*`/`h-*` pairs at
 * each call site, e.g. `w-16 h-24`) so `object-fit: cover` shows the whole
 * figure — head to shoes — with no cropping and no letterboxing, framed in a
 * soft rounded card rather than a circle. A tall aspect ratio is required
 * for this effect; a square/circular `className` here falls back to
 * cropping to the head, which is what call sites that genuinely want a
 * small round badge (none currently) would still get.
 *
 * `interactive` adds the idle "alive" motion and hover/press reaction used
 * for the floating launcher; other call sites (chat header, Quick Guide)
 * render the same art perfectly still, since a person-sized breathing
 * animation next to body text would be distracting rather than premium.
 * Both respect `prefers-reduced-motion`.
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
      <span
        role="img"
        aria-label="Halku, personal AI trainer"
        className={cn(
          "relative inline-block shrink-0 origin-bottom overflow-hidden rounded-2xl bg-black/80 bg-cover bg-top",
          interactive &&
            "motion-safe:animate-[halku-breathe_4.5s_ease-in-out_infinite] motion-safe:group-hover:animate-[halku-greet_0.6s_ease-out_forwards] motion-safe:group-active:animate-[halku-greet_0.45s_ease-out_forwards]",
          className,
        )}
        style={{ backgroundImage: `url(${artSrc})` }}
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
