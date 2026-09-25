import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Dumbbell, LineChart, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { completeAuthCallback } from "@/lib/auth-callback";
import { parseAuthCallback, resolveAuthView } from "@/lib/auth-state";
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
        content:
          "Log meals with photos, hit your calorie and protein targets, and watch your lean-bulk trends.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Target,
    title: "Targets that fit you",
    body: "Configurable calorie and protein goals — starting at 2,550 kcal and 130 g protein.",
  },
  {
    icon: Camera,
    title: "Photo-assisted meal logs",
    body: "Name what you ate — attach a photo too — and get an approximate macro estimate you can correct before saving.",
  },
  {
    icon: LineChart,
    title: "Real trends",
    body: "Today through last month plus custom ranges: weight, waist, sleep and macro trends.",
  },
  {
    icon: Dumbbell,
    title: "Habit consistency",
    body: "Workout minutes, water, sleep and creatine adherence tracked day by day. Workout logging needs a free account; food tracking works right away.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [verifying, setVerifying] = useState(false);

  // Supabase redirects email-verification and magic-link clicks back to this
  // page. The client turns the URL's tokens into a session on its own; this
  // page's job is to notice that and send the user into the app instead of
  // showing marketing / sign-up choices to someone who just signed in.
  useEffect(() => {
    const callback = parseAuthCallback(window.location.search, window.location.hash);
    if (callback.kind === "pending") {
      setVerifying(true);
      void completeAuthCallback(window.location.search, window.location.hash).then((problem) => {
        window.history.replaceState(null, "", window.location.pathname);
        if (problem) {
          toast.error(problem);
          navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
        }
      });
    }
    if (callback.kind === "error") {
      toast.error(callback.message);
      navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (resolveAuthView({ loading, hasSession: session !== null }) === "authenticated") {
      if (verifying)
        toast.success("Email verified. You're signed in — taking you to your dashboard.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, session, verifying, navigate]);

  // Give a pending callback a moment to produce a session; if it never does
  // (bad/consumed token), stop waiting and send the user to sign in.
  useEffect(() => {
    if (!verifying || session) return;
    const timer = setTimeout(() => {
      toast.error("We couldn't complete sign-in from that link. Please sign in.");
      navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
    }, 10000);
    return () => clearTimeout(timer);
  }, [verifying, session, navigate]);

  if (verifying || (loading === false && session !== null)) {
    return (
      <div className="hero-glow flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground" role="status">
          {verifying ? "Verifying your email…" : "Signing you in…"}
        </p>
      </div>
    );
  }

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
          A private nutrition and physique tracker built for a gradual, controlled gain. Log meals
          in seconds, keep protein on target, and watch weight and waist move the way you want.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={startTrial}>
            Start tracking food — no sign-up
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth" search={{ mode: "signin" }}>
              I already have an account
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Try food tracking free for 3 days with nothing to fill in — no account needed. Workout
          tracking needs a free account so your training history follows you across devices; create
          one any time and everything you logged as a guest is kept.
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
          Photo estimates are approximations, never exact. You always confirm serving sizes and
          macros before a meal is saved.
        </p>
      </div>
    </div>
  );
}
