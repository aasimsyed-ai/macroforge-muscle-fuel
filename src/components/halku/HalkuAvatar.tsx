import type { HalkuGender } from "@/lib/halku/types";
import { HALKU_CHARACTER_ART } from "./halkuAssets";

/**
 * Halku's visual mark. Renders the approved character illustration from
 * `halkuAssets.ts` the moment one is dropped in there — today both paths are
 * `null`, so every call falls through to the abstract placeholder below
 * (rounded head + strong shoulders + a small spark accent, echoing the app's
 * own Flame mark for a family resemblance). That placeholder is NOT the
 * final character art — it's deliberately basic, since producing a
 * polished, illustrated superhero character needs a real illustrator or an
 * image-generation tool, neither available in this environment. Documented
 * as a known gap rather than faked; see `halkuAssets.ts` for exactly what's
 * needed and where it plugs in. The two `gender` variants share the same
 * silhouette/colors and differ only in a small, non-stereotyped hair shape,
 * per "equally strong and confident, not a recolor."
 */
export function HalkuAvatar({ gender, className }: { gender: HalkuGender; className?: string }) {
  const artSrc = HALKU_CHARACTER_ART[gender];
  if (artSrc) {
    return <img src={artSrc} alt="Halku, personal AI trainer" className={className} />;
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
