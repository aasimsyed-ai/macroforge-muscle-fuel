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

import { HalkuAvatar } from "./HalkuAvatar";

const QUICK_QUESTIONS = [
  "What does progressive overload mean?",
  "What are sets and reps?",
  "How do I log homemade food?",
  "Why is my protein target this amount?",
  "Why didn't you recommend increasing my bicep weight?",
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

  function toggleGender() {
    const next: HalkuGender = gender === "masculine" ? "feminine" : "masculine";
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
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Halku, your personal AI trainer"
        className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full border border-primary/30 bg-card shadow-lg transition-transform hover:scale-105 sm:bottom-6"
      >
        <HalkuAvatar gender={gender} className="size-10" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-sm flex-col gap-3">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <HalkuAvatar gender={gender} className="size-9 shrink-0" />
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle>Halku · Personal AI Trainer</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Ask about anything in the app, or your own progress.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={toggleGender} className="shrink-0 text-xs">
                {gender === "masculine" ? "Masc." : "Fem."}
              </Button>
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
                  className={`rounded-lg p-2 text-xs ${
                    message.role === "user"
                      ? "ml-6 bg-primary/15 text-right"
                      : "mr-6 bg-card"
                  }`}
                >
                  {message.role === "halku" && message.grounded ? (
                    <Badge variant="secondary" className="mb-1">
                      Your data
                    </Badge>
                  ) : null}
                  <p>{message.text}</p>
                </div>
              ))
            )}
            {sending ? <p className="p-2 text-xs text-muted-foreground">Halku is thinking…</p> : null}
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void ask(question)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-left text-[11px] transition-colors hover:border-primary"
                >
                  {question}
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
            <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="size-3" aria-hidden="true" /> Halku never invents your workout or food data.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
