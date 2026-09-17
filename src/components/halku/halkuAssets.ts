import type { HalkuGender } from "@/lib/halku/types";

/**
 * The single place the approved Halku character art is wired in.
 * `HalkuAvatar` renders these images automatically, falling back to the
 * abstract placeholder mark whenever a path here is `null`. Files live in
 * `public/halku/` (added verbatim — not resized, recompressed, or
 * regenerated). To swap in updated art later, replace the files in that
 * folder and/or this record; no other file needs to change — every
 * consumer reads through this one module.
 *
 * `needsBlackKeyFilter` records whether the PNG's own background is
 * genuinely opaque (no real transparency at all) and therefore needs
 * `HalkuAvatar`'s SVG luminance-key filter to fake it at display time.
 * Determined by directly sampling each file's pixels, not assumed:
 *   - masculine: fully opaque (0,0,0,255) at every sampled background
 *     pixel — no alpha channel at all. Needs the filter.
 *   - feminine: already has real alpha transparency baked in (confirmed
 *     alpha=0 at background samples) — a hard, unfeathered cutout rather
 *     than a smooth matte, but a *real* one. Applying the same luminance
 *     filter on top of it was actively harmful: it re-derives a second,
 *     different alpha boundary from raw brightness on top of the existing
 *     cutout edge, and the two disagreeing edges is what produced the
 *     reported pixelated/scattered/haloed appearance — not the source PNG
 *     itself, which looks clean and sharp when viewed plainly. Does NOT
 *     need (and must not get) the filter.
 */
export const HALKU_CHARACTER_ART: Record<
  HalkuGender,
  { src: string; needsBlackKeyFilter: boolean } | null
> = {
  masculine: { src: "/halku/halku-male-neutral.png", needsBlackKeyFilter: true },
  feminine: { src: "/halku/halku-female-neutral.png", needsBlackKeyFilter: false },
};

export function hasHalkuCharacterArt(): boolean {
  return HALKU_CHARACTER_ART.masculine !== null && HALKU_CHARACTER_ART.feminine !== null;
}
