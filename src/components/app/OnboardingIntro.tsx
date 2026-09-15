import { useEffect, useState } from "react";
import { CirclePlus, CircleCheck, Flame, Pencil, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding";

const STEPS = [
  {
    icon: Flame,
    title: "Welcome to MacroForge",
    body: "A fast, no-clutter way to track your daily nutrition and stay on top of your targets.",
  },
  {
    icon: CirclePlus,
    title: "Add food in seconds",
    body: "Type what you ate, add a photo if you like, and get an instant calorie and macro estimate.",
  },
  {
    icon: Pencil,
    title: "Edit anytime",
    body: "Food names and every nutrition number stay editable — nothing is locked in once it's estimated.",
  },
  {
    icon: Zap,
    title: "Frequent foods, one tap",
    body: "Foods you log often show up as quick shortcuts, so your regulars take one tap instead of a full form.",
  },
  {
    icon: CircleCheck,
    title: "You're ready",
    body: "That's everything you need to get started — log your first meal whenever you're ready.",
  },
] as const;

/**
 * A short, skippable first-run intro — shown once per device, for both
 * guests and signed-in users. Not a tutorial system: just five static
 * steps with no branching, no persistence beyond a single "seen" flag.
 */
export function OnboardingIntro() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasSeenOnboarding()) setOpen(true);
  }, []);

  function finish() {
    markOnboardingSeen();
    setOpen(false);
  }

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Any way of dismissing the dialog (Escape, backdrop click, the
        // built-in close button) counts as "skip" — none of them should
        // bring the intro back on the next visit.
        if (!next) finish();
      }}
    >
      <DialogContent className="max-w-sm text-center sm:text-center">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon className="size-6" aria-hidden="true" />
          </div>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.body}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="sm:justify-between">
          {!isLast ? (
            <Button type="button" variant="ghost" size="sm" onClick={finish}>
              Skip
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
          >
            {isLast ? "Get started" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
