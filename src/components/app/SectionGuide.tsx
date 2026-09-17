import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HalkuHeadshot } from "@/components/halku/HalkuAvatar";
import { getHalkuGender } from "@/lib/halku/preferences";
import type { HalkuGender } from "@/lib/halku/types";
import {
  hasSeenSectionGuide,
  markSectionGuideSeen,
  SECTION_GUIDES,
  type GuideSectionId,
} from "@/lib/sectionGuides";

/**
 * Renders nothing visible on its own except a "?" reopen button — the guide
 * itself is a Dialog that opens automatically the first time this section is
 * seen on this device, and otherwise only on request. One compact screen (a
 * short intro + a term/meaning glossary + "do this first"), not a multi-step
 * wizard — concise by design, distinct from the one-time app-wide
 * `OnboardingIntro`. Shows a small Halku avatar in the header purely to
 * visually tie this tip sheet to the same character as the chat panel
 * (reusing the same stored gender preference) — it's still the same
 * concise glossary content, not a rebuilt/duplicated onboarding tour.
 */
export function SectionGuide({ section }: { section: GuideSectionId }) {
  const [open, setOpen] = useState(false);
  // See HalkuPanel.tsx for why this starts at the SSR-safe default and is
  // corrected from localStorage in an effect, not a lazy initializer.
  const [gender, setGender] = useState<HalkuGender>("masculine");
  const content = SECTION_GUIDES[section];

  useEffect(() => {
    if (!hasSeenSectionGuide(section)) setOpen(true);
    // Only check once per mount of this section — re-checking on every
    // render would reopen it if something else closed it programmatically.
  }, [section]);

  useEffect(() => {
    setGender(getHalkuGender());
  }, []);

  function dismiss() {
    markSectionGuideSeen(section);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 shrink-0 gap-1.5 rounded-full border border-primary/20 bg-card/70 px-2 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
        aria-label={`${content.title} guide`}
        onClick={() => setOpen(true)}
      >
        <HalkuHeadshot gender={gender} className="size-6" />
        <span className="hidden text-[11px] font-semibold sm:inline">Quick guide</span>
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <HalkuHeadshot gender={gender} className="size-12 shrink-0 shadow-sm" />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                  Halku's quick guide
                </p>
                <DialogTitle className="text-base leading-tight">{content.title}</DialogTitle>
              </div>
            </div>
            <DialogDescription>{content.intro}</DialogDescription>
          </DialogHeader>

          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {content.terms.map((item) => (
              <li key={item.term} className="rounded-md bg-secondary/60 p-2">
                <span className="font-semibold">{item.term}</span>
                <span className="text-muted-foreground"> — {item.meaning}</span>
              </li>
            ))}
          </ul>

          <p className="rounded-md bg-primary/10 p-2 text-xs text-primary">{content.firstStep}</p>

          <DialogFooter>
            <Button type="button" size="sm" onClick={dismiss}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
