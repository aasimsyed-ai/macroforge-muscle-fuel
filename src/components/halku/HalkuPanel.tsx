import { useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useGoals, useMeals } from "@/lib/data";
import { guestActive } from "@/lib/guest";
import { answerHalkuQuestion } from "@/lib/halku/api";
import { getHalkuGender, setHalkuGender } from "@/lib/halku/preferences";
import type { HalkuGender, HalkuKnownData, HalkuMessage } from "@/lib/halku/types";
import { sumMeals } from "@/lib/nutrition";
import { useExerciseProgressBoard } from "@/lib/workouts/hooks";

import { HalkuAvatar, HalkuHeadshot } from "./HalkuAvatar";
import { HalkuMessageContent } from "./HalkuMessageContent";

// Compact chip label vs. the full question actually sent — keeps the quick-
// question row scannable and not wrapped in a wall of text on small screens
// while still asking the exact phrasing lib/halku/respond.ts's keyword
// classifier expects.
const QUICK_QUESTIONS: ReadonlyArray<{ label: string; question: string }> = [
  { label: "What's progressive overload?", question: "What does progressive overload mean?" },
  { label: "Sets vs. reps", question: "What are sets and reps?" },
  { label: "Log a homemade meal", question: "How do I log homemade food?" },
  { label: "Why this protein target?", question: "Why is my protein target this amount?" },
  {
    label: "Why not more weight on biceps?",
    question: "Why didn't you recommend increasing my bicep weight?",
  },
];

const GENDER_OPTIONS: ReadonlyArray<{ value: HalkuGender; label: string }> = [
  { value: "masculine", label: "Male" },
  { value: "feminine", label: "Female" },
];

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Always-available floating launcher (bottom-right, above the mobile nav
 * bar) opening Halku, the in-app personal AI trainer. v1 answers are
 * data-honest but rule-based (see lib/halku/respond.ts) — see that file and
 * the final build report for why, and what a real free-form LLM upgrade
 * needs.
 */
export function HalkuPanel() {
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState<HalkuGender>(() => getHalkuGender());
  const [messages, setMessages] = useState<HalkuMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const isGuest = guestActive();
  const goals = useGoals();
  const todayRange = { from: startOfDay(new Date()), to: endOfDay(new Date()) };
  const todayMeals = useMeals(todayRange.from, todayRange.to, { enabled: open });
  const progressBoard = useExerciseProgressBoard("this_week", { enabled: open && !isGuest });

  function selectGender(next: HalkuGender) {
    setGender(next);
    setHalkuGender(next);
  }

  function knownData(): HalkuKnownData {
    const todayTotals = sumMeals(todayMeals.data);
    return {
      today: goals.data
        ? {
            calories: todayTotals.calories,
            proteinG: todayTotals.protein,
            calorieTarget: goals.data.calorie_target,
            proteinTargetG: goals.data.protein_target_g,
          }
        : null,
      progressRows: (progressBoard.data ?? []).map((row) => ({
        exerciseName: row.exerciseName,
        muscleGroup: row.muscleGroup,
        status: row.comparison.status,
        explanation: row.comparison.explanation,
      })),
    };
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || sending) return;
    setMessages((current) => [...current, { id: uid(), role: "user", text, grounded: false }]);
    setInput("");
    setSending(true);
    try {
      const answer = await answerHalkuQuestion(text, knownData());
      setMessages((current) => [
        ...current,
        { id: uid(), role: "halku", text: answer.text, grounded: answer.grounded },
      ]);
    } catch {
      // answerHalkuQuestion already falls back locally on any remote failure —
      // this only catches a genuinely unexpected error, so the user sees a
      // clear, honest notice instead of the question silently going nowhere.
      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: "halku",
          text: "Something went wrong answering that — please try again.",
          grounded: false,
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* The launcher is a compact standing character, not a round profile
          photo — the outer wrapper carries the fixed position/z-index/tap
          target and a soft "ground shadow" ellipse; the inner button is
          sized to the source art's own 2:3 ratio so no cropping happens. */}
      <div className="fixed bottom-20 right-4 z-40 sm:bottom-6">
        <div
          className="pointer-events-none absolute inset-x-1 bottom-0 h-2 rounded-full bg-black/40 blur-sm"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Halku, your personal AI trainer"
          className="group relative block h-24 w-16 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <HalkuAvatar
            gender={gender}
            interactive
            className="h-24 w-16 shadow-xl shadow-primary/10 ring-1 ring-primary/30 group-hover:shadow-primary/30 group-hover:ring-primary/60"
          />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(32rem,90vh)] w-[calc(100vw-2rem)] max-w-md flex-col gap-3 sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <HalkuHeadshot gender={gender} className="size-12 shrink-0" />
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="text-base leading-tight">Halku</DialogTitle>
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                  Personal AI Trainer
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label="Halku's appearance"
                className="flex shrink-0 gap-0.5 rounded-full bg-secondary p-0.5 text-xs"
              >
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={gender === option.value}
                    onClick={() => selectGender(option.value)}
                    className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                      gender === option.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-2 overflow-y-auto rounded-md bg-secondary/40 p-2">
            {messages.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                {isGuest
                  ? "I can help with general fitness and nutrition questions. Create an account to also ask about your own workout progress."
                  : "Ask me anything — I'll say \"Your data shows…\" when an answer uses your real logged history, and tell you honestly when I don't have enough data."}
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg p-2.5 text-sm leading-snug ${
                    message.role === "user"
                      ? "ml-6 bg-primary/15 text-right"
                      : message.isError
                        ? "mr-6 border border-destructive/30 bg-destructive/10"
                        : "mr-6 bg-card"
                  }`}
                >
                  {message.role === "halku" && message.grounded ? (
                    <Badge variant="secondary" className="mb-1">
                      Your data
                    </Badge>
                  ) : null}
                  {message.role === "halku" ? (
                    <HalkuMessageContent text={message.text} />
                  ) : (
                    <p>{message.text}</p>
                  )}
                </div>
              ))
            )}
            {sending ? (
              <div className="mr-6 flex items-center gap-1 rounded-lg bg-card p-2.5">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                <span className="sr-only">Halku is thinking…</span>
              </div>
            ) : null}
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map(({ label, question }) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void ask(question)}
                  className="rounded-full border border-border bg-card px-2.5 py-1.5 text-left text-[11px] transition-colors hover:border-primary hover:bg-primary/5 active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Halku…"
              aria-label="Ask Halku"
              disabled={sending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="shrink-0 transition-transform active:scale-90"
            >
              <Send className="size-4" />
            </Button>
          </form>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="size-3" aria-hidden="true" /> Halku never invents your workout or
            food data.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
