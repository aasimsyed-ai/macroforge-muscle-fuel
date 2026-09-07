import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Flame, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { guestActive, guestExpired, migrateGuestToCloud } from "@/lib/guest";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — MacroForge Nutrition Tracker" },
      {
        name: "description",
        content: "Sign in to MacroForge to log meals, track macros and follow your lean-bulk progress across devices.",
      },
      { property: "og:title", content: "Sign in — MacroForge Nutrition Tracker" },
      { property: "og:description", content: "Access your private nutrition and muscle-gain dashboard." },
    ],
  }),
  component: AuthPage,
});

const LAST_EMAIL_KEY = "mf:last-email";

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [trialOver, setTrialOver] = useState(false);

  async function afterSignedIn() {
    if (guestActive()) {
      try {
        await migrateGuestToCloud();
        toast.success("Your trial data is now saved to your account.");
      } catch {
        toast.error("Signed in, but saving your trial data failed — it is still on this device.");
      }
    }
    qc.clear();
    navigate({ to: "/dashboard", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    try {
      const saved = localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setTab("signin");
      }
    } catch {
      // storage unavailable — fine
    }
    if (guestActive() && guestExpired()) {
      setTrialOver(true);
      setTab("signup");
    }
  }, [navigate]);

  function rememberEmail(value: string) {
    try {
      localStorage.setItem(LAST_EMAIL_KEY, value);
    } catch {
      // ignore
    }
  }

  async function sendMagicLink() {
    if (!email.trim()) {
      toast.error("Enter your email first, then request a link.");
      return;
    }
    setLinkBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
      });
      if (error) throw error;
      rememberEmail(email.trim());
      toast.success("Login link sent — open it on this device to sign in without a password.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the login link");
    } finally {
      setLinkBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        rememberEmail(email.trim());
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await afterSignedIn();
        } else {
          toast.success("Check your email to confirm your account, then sign in.");
          setTab("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        rememberEmail(email.trim());
        await afterSignedIn();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-md p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Flame className="size-4" aria-hidden="true" /> MacroForge
        </div>
        <h1 className="mt-2 text-2xl font-bold">{tab === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your meals, macros and body metrics stay private to your account.
        </p>

        {trialOver ? (
          <div className="mt-4 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs text-foreground">
            Your 3-day trial has ended. Create a free account now and everything you logged on this device is kept.
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signup">Sign up</TabsTrigger>
            <TabsTrigger value="signin">Sign in</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : tab === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full text-xs"
          onClick={sendMagicLink}
          disabled={linkBusy}
        >
          <Mail className="size-4" />
          {linkBusy ? "Sending…" : "Email me a login link (no password)"}
        </Button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="secondary" className="w-full" onClick={google}>
          Continue with Google
        </Button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          You stay signed in on this device — no need to log in again next time.
        </p>
      </div>
    </div>
  );
}
