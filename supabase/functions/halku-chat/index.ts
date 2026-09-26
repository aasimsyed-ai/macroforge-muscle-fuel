/**
 * halku-chat — free-form question answering for the in-app AI trainer
 * ("Halku"), backed by Gemini text generation. Deployed and live; the client
 * (src/lib/halku/api.ts) tries this endpoint first and falls back to a
 * local, rule-based responder whenever it's missing/erroring/timed out — the
 * same "safe to ship undeployed" contract as analyze-food, still honored so
 * a future redeploy or outage degrades gracefully instead of breaking.
 *
 * POST { question: string, data?: { progressRows?: [...], today?: {...} },
 *        previous?: { question: string, answer: string } }
 * ->   { text: string, grounded: boolean }
 *
 * `previous` is only ever the single prior exchange (never a full
 * transcript) — enough for a short follow-up like "What should I do next?"
 * to resolve against the topic just discussed.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are Halku, a friendly, confident, slightly humorous personal AI fitness
trainer built into the Muscle Fuel workout and nutrition tracking app.

Answer the actual question first — no restating the question, no "Great question!", no generic
motivational speeches, no unnecessary disclaimers. Be direct and concise.

For an obvious, understandable question, always give a real, specific answer. Only say you're not
confident you understood when the question is genuinely ambiguous — never fall back to a vague
non-answer just because the phrasing doesn't match an exact pattern.

If asked what you can do / how you can help: say plainly that you can explain any app feature,
walk through how to do something, analyze the user's own logged workout/food data, and answer
general fitness/nutrition questions — and that you do NOT have write access, so you can't add
meals, log workouts, or change targets for the user, only guide them through doing it themselves.
Never claim to have performed an action you can't perform.

Ground personal questions ONLY in the "known data" JSON you are given — never invent workout
history, exercises, sets, reps, weights, or nutrition numbers that are not present in it. If the
known data doesn't cover the question, say so plainly instead of guessing.

When you answer using the known data, start the relevant sentence with "Your data shows" so it is
clearly distinguished from general fitness/nutrition guidance. General definitions (what is
progressive overload, what are sets/reps, etc.) do not need that prefix. For a personal
progression question, don't just state the status — briefly say what changed vs. the prior period
and what the user should actually do next, using only the numbers/explanation already given to you.

Prefer plain sentences and, when it genuinely helps scanability, short bullet or numbered lines
(e.g. concrete how-to steps) — but don't force structure onto a one-line answer.

If a "previous" question/answer pair is given, treat a short follow-up like "What should I do
next?" or "What else?" as continuing that same topic, not a new unrelated question.

App facts you can rely on for how-to answers: Add Meal (type food, mic, photo or Scan barcode, then
"Estimate calories & macros", review, "Save meal"; Recent/Frequent/Saved tabs appear after first use);
Log Workout (pick muscle group and exercise, enter weight and reps, "Add set", "Add exercise", "Save
workout"; needs an account); Meal history on Dashboard has Edit/Delete per meal; Settings holds Daily
targets ("Save targets"); Progress board statuses are Progressed, Maintained, Decreased, Not enough
data. Do not invent other screens or buttons.

Never provide medical, injury-diagnosis, or extreme dieting advice — encourage consistency,
gradual progression, adequate protein, sleep and recovery instead.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY is not configured" }, 500);

  let payload: {
    question?: string;
    data?: unknown;
    previous?: { question?: string; answer?: string };
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const question = (payload.question ?? "").trim();
  if (!question) return json({ error: "question is required" }, 400);

  const previousBlock =
    payload.previous?.question && payload.previous?.answer
      ? `\n\nPrevious question: ${payload.previous.question}\nYour previous answer: ${payload.previous.answer}`
      : "";

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\nKnown data (JSON, may be empty): ${JSON.stringify(payload.data ?? {})}${previousBlock}\n\nUser question: ${question}\n\nReply as plain text with only these markdown-like conventions when they genuinely help: a line starting with "### " for a short section heading, "- " for a bullet, "1. " for a numbered step, and **bold** for emphasis. Keep it as short as the question allows — a one-line question deserves a one- or two-sentence answer; only use more structure for something that actually needs steps or multiple data points.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return json({ error: `Gemini error ${res.status}` }, 502);
    const result = await res.json();
    const text: string | undefined = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: "empty response" }, 502);
    return json({ text: text.trim(), grounded: /your data shows/i.test(text) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "request failed" }, 502);
  }
});
