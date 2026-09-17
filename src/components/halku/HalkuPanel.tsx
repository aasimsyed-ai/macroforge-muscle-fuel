import { useEffect, useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { ShieldCheck } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGoals, useMeals } from "@/lib/data";
import { guestActive } from "@/lib/guest";
import { answerHalkuQuestion } from "@/lib/halku/api";
import { getHalkuGender, setHalkuGender } from "@/lib/halku/preferences";
import type { HalkuGender, HalkuKnownData, HalkuMessage } from "@/lib/halku/types";
import { sumMeals } from "@/lib/nutrition";
import { useExerciseProgressBoard } from "@/lib/workouts/hooks";

import { HalkuAvatar, HalkuHeadshot } from "./HalkuAvatar";

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
  // Starts at the deterministic SSR-safe default and is corrected from
  // localStorage in an effect below, rather than read during the initial
  // render itself — localStorage doesn't exist on the server, so a lazy
  // initializer here would read "masculine" during SSR and, depending on
  // exactly how hydration reconciles it, could get stuck showing that
  // default even when the client's real stored preference is "feminine"
  // (reproduced: the launcher kept rendering the male asset for a device
  // with "feminine" already saved). An effect runs client-only, after
  // mount, so it always applies the real preference.
  const [gender, setGender] = useState<HalkuGender>("masculine");
  const [messages, setMessages] = useState<HalkuMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setGender(getHalkuGender());
  }, []);

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
    // Only ever the single prior exchange, not a growing transcript — just
    // enough for a short follow-up ("What should I do next?") to resolve
    // against the topic just discussed, without building a memory system.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastHalku = [...messages].reverse().find((m) => m.role === "halku" && !m.isError);
    const previous =
      lastUser && lastHalku ? { question: lastUser.text, answer: lastHalku.text } : undefined;
    setMessages((current) => [...current, { id: uid(), role: "user", text, grounded: false }]);
    setInput("");
    setSending(true);
    try {
      const answer = await answerHalkuQuestion(text, knownData(), previous);
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
      {/* The launcher is a free-standing character — no card, box, or frame
          (see HalkuAvatar's own doc comment for how the source art's flat
          backdrop is made to disappear against this dark UI). The outer
          wrapper carries the fixed position and a soft ground-shadow
          ellipse; the character itself is sized to the source art's own 2:3
          ratio at every breakpoint so the whole figure — head to feet —
          shows with no cropping.
          Only the outer wrapper is `pointer-events-none` — the visible
          character/shadow render at their full "clearly noticeable" size,
          but the actual clickable hit-target (the `<button>` below) is a
          smaller region inset from that box. Real pages can scroll enough
          content under this fixed corner for it to reach a page's own
          buttons (e.g. a food item's per-row "Remove" button in a longer
          Add Meal list) — confirmed by measuring the rendered button's
          bounding box against nearby page controls. A full-box hit-target
          made those controls permanently unclickable whenever they landed
          under this corner, with no visible indication why. Insetting the
          hit-target trades a little of the launcher's own tap-target size
          for not silently eating clicks meant for the page underneath. */}
      <div className="pointer-events-none fixed bottom-[5.25rem] right-2 z-40 sm:bottom-5 sm:right-5">
        <div
          className="pointer-events-none absolute inset-x-3 bottom-0 h-2 rounded-full bg-foreground/15 blur-sm sm:inset-x-4"
          aria-hidden="true"
        />
        <div className="group relative h-[112px] w-[76px] sm:h-[150px] sm:w-[100px]">
          <HalkuAvatar
            gender={gender}
            interactive
            className="pointer-events-none h-[112px] w-[76px] drop-shadow-xl sm:h-[150px] sm:w-[100px]"
          />
          <span className="pointer-events-none absolute bottom-1 right-0 rounded-full border border-primary/30 bg-card px-2 py-1 text-[10px] font-bold text-primary shadow-lg">
            ASK
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open Halku — your Personal AI Trainer and guide for using Muscle Fuel"
            title={"Halku\nPersonal AI Trainer\nAsk Halku anything"}
            className="pointer-events-auto absolute inset-x-[15%] inset-y-[20%] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* No fixed height here on purpose — with only the empty-state or a
            couple of messages, the dialog should hug its actual content
            instead of reserving a tall, mostly-blank rectangle. `max-h`
            only caps it once there's enough conversation to need one. */}
        <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1rem)] max-w-md flex-col gap-3 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-3 pr-12">
              <HalkuHeadshot gender={gender} className="size-14 shrink-0 shadow-sm" />
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="text-lg leading-tight">Halku</DialogTitle>
                <p className="text-xs font-semibold text-primary">Your personal AI trainer</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Fitness · food · your progress
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label="Halku's appearance"
                className="flex shrink-0 gap-0.5 rounded-full border border-border bg-background/60 p-0.5 text-[10px]"
              >
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={gender === option.value}
                    onClick={() => selectGender(option.value)}
                    className={`rounded-full px-2 py-1 font-medium transition-colors ${
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

          {/* The `max-h-[48vh]`/`overflow-y-auto` cap lives on
              ConversationContent's `scrollClassName` (the real scrollable
              element), not here — see conversation.tsx for why. That's what
              lets this grow to fit a short conversation, cap at 48% of the
              viewport height for a long one, and scroll internally once a
              reply is longer than that, instead of silently clipping with
              no way to reach the rest of it. */}
          <Conversation className="mx-3 rounded-md bg-secondary/30">
            <ConversationContent className="gap-3 p-3" scrollClassName="max-h-[48vh] rounded-md">
              {messages.length === 0 ? (
                <div className="flex items-start gap-3 py-1">
                  <HalkuHeadshot gender={gender} className="size-9" />
                  <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                    {isGuest
                      ? "Ask me about fitness or nutrition. Sign in when you want guidance based on your own progress."
                      : "Ask me anything. When I use your logs, I'll clearly say “Your data shows…”"}
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <Message key={message.id} from={message.role === "user" ? "user" : "assistant"}>
                    <div className="flex items-start gap-2">
                      {message.role === "halku" ? (
                        <HalkuHeadshot gender={gender} className="mt-0.5 size-7" />
                      ) : null}
                      <MessageContent
                        className={
                          message.isError
                            ? "rounded-md border border-destructive/30 bg-destructive/10 p-2.5"
                            : undefined
                        }
                      >
                        {message.role === "halku" && message.grounded ? (
                          <Badge variant="secondary" className="w-fit text-[10px]">
                            Your data
                          </Badge>
                        ) : null}
                        <MessageResponse>{message.text}</MessageResponse>
                      </MessageContent>
                    </div>
                  </Message>
                ))
              )}
              {sending ? (
                <div className="flex items-center gap-2">
                  <HalkuHeadshot gender={gender} className="size-7" />
                  <Shimmer className="text-xs">Halku is thinking…</Shimmer>
                </div>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton className="bottom-2 size-8" />
          </Conversation>

          {messages.length === 0 ? (
            <div className="mx-3 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map(({ label, question }) => (
                <Button
                  key={question}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void ask(question)}
                  className="h-auto rounded-full px-2.5 py-1.5 text-left text-[11px] font-medium whitespace-normal"
                >
                  {label}
                </Button>
              ))}
            </div>
          ) : null}

          <PromptInput onSubmit={({ text }) => void ask(text)} className="mx-3 w-auto">
            <PromptInputTextarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Halku…"
              aria-label="Ask Halku"
              disabled={sending}
              className="min-h-14 max-h-28"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                {...(sending ? { status: "submitted" as const } : {})}
                disabled={sending || !input.trim()}
                aria-label="Send"
                className="shrink-0"
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="mx-4 mb-3 flex items-center gap-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" aria-hidden="true" /> Halku never invents
            your workout or food data.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
