import type { HalkuGender } from "@/lib/halku/types";

/**
 * The single place to drop in the approved Halku character art once it
 * exists. Today both paths are `null` — no such art is in this repository
 * or its history (verified by searching the full working tree, all git
 * history across every branch, and Lovable's project/workspace knowledge:
 * nothing found). `HalkuAvatar` falls back to the abstract placeholder mark
 * whenever a path here is `null`.
 *
 * To integrate the real artwork later: add the masculine and feminine
 * illustrations (SVG preferred for crisp scaling at both the floating-
 * launcher's small size and larger in-panel use; PNG/WEBP with @2x sizing
 * also works) to `public/halku/`, then set the two paths below — e.g.
 * `masculine: "/halku/halku-masculine.svg"`. No other file needs to change;
 * every consumer (HalkuAvatar, and anywhere else that renders it) reads
 * through this one module.
 */
export const HALKU_CHARACTER_ART: Record<HalkuGender, string | null> = {
  masculine: null,
  feminine: null,
};

export function hasHalkuCharacterArt(): boolean {
  return HALKU_CHARACTER_ART.masculine !== null && HALKU_CHARACTER_ART.feminine !== null;
}
