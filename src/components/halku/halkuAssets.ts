import type { HalkuGender } from "@/lib/halku/types";

/**
 * The single place the approved Halku character art is wired in.
 * `HalkuAvatar` renders these images automatically, falling back to the
 * abstract placeholder mark whenever a path here is `null`. Files live in
 * `public/halku/` (added verbatim — not resized, recompressed, or
 * regenerated). To swap in updated art later, replace the files in that
 * folder and/or these two paths; no other file needs to change — every
 * consumer reads through this one module.
 */
export const HALKU_CHARACTER_ART: Record<HalkuGender, string | null> = {
  masculine: "/halku/halku-male-neutral.png",
  feminine: "/halku/halku-female-neutral.png",
};

export function hasHalkuCharacterArt(): boolean {
  return HALKU_CHARACTER_ART.masculine !== null && HALKU_CHARACTER_ART.feminine !== null;
}
