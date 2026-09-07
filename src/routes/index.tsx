import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Dumbbell, LineChart, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ensureGuest } from "@/lib/guest";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MacroForge — Nutrition & Muscle-Gain Tracker" },
      {
        name: "description",
        content:
          "Track calories, protein, macros, water, creatine, weight, waist, sleep and workouts in one dark, mobile-first lean-bulk dashboard.",
      },
      { property: "og:title", content: "MacroForge — Nutrition & Muscle-Gain Tracker" },
      {
        property: "og:description",
        content: "Log meals with photos, hit your calorie and protein targets, and watch your lean-bulk trends.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Target, title: "Targets that fit you", body: "Configurable calorie and protein goals — starting at 2,550 kcal and 130 g protein." },
  { icon: Camera, title: "Photo-assisted meal logs", body: "Attach a meal photo, get an approximate macro estimate, then correct it before saving." },
  { icon: LineChart, title: "Real trends", body: "Today through last month plus custom ranges: weight, waist, sleep and macro trends." },
  { icon: Dumbbell, title: "Habit consistency", body: "Workout minutes, water, sleep and creatine adherence tracked day by day." },
];

function Landing() {
  const navigate = useNavigate();

  function startTrial() {
    ensureGuest();
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen hero-glow">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-5 py-14 sm:py-24">
        <span className="w-fit rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          Lean-bulk tracking · 64 kg → 70 kg
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-[1.05] sm:text-6xl">
          Forge muscle with <span className="text-primary">honest numbers</span>.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          A private nutrition and physique tracker built for a gradual, controlled gain. Log meals in seconds, keep
          protein on target, and watch weight and waist move the way you want.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={startTrial}>
            Start tracking — no sign-up
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth" search={{ mode: "signin" }}>
              I already have an account
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Try it free for 3 days with nothing to fill in. Create an account any time to save your data across devices.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="panel p-5">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Photo estimates are approximations, never exact. You always confirm serving sizes and macros before a meal is
          saved.
        </p>
      </div>
    </div>
  );
}
