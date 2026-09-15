/**
 * halku-chat — free-form question answering for the in-app AI trainer
 * ("Halku"), backed by Gemini text generation.
 *
 * DORMANT SCAFFOLD: written but NOT deployed. The client
 * (src/lib/halku/api.ts) already tries this endpoint first and falls back to
 * a local, rule-based responder whenever it's missing/erroring/undeployed —
 * exactly the same "safe to ship undeployed" contract as analyze-food. No
 * code change is needed elsewhere once this is deployed.
 *
 * POST { question: string, data?: { progressRows?: [...], today?: {...} } }
 * ->   { text: string, grounded: boolean }
 *
 * Deploy (same pattern as analyze-food):
 *   1. Get a free key at https://aistudio.google.com/app/apikey
 *   2. supabase secrets set GEMINI_API_KEY=your_key
 *   3. supabase functions deploy halku-chat
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
trainer built into a nutrition and workout tracking app. Keep answers short and clear.

Ground personal questions ONLY in the "known data" JSON you are given — never invent workout
history, exercises, sets, reps, weights, or nutrition numbers that are not present in it. If the
known data doesn't cover the question, say you don't have enough data instead of guessing.

When you answer using the known data, start the relevant sentence with "Your data shows" so it is
clearly distinguished from general fitness/nutrition guidance. General definitions (what is
progressive overload, what are sets/reps, etc.) do not need that prefix.

Never provide medical, injury-diagnosis, or extreme dieting advice — encourage consistency,
gradual progression, adequate protein, sleep and recovery instead.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY is not configured" }, 500);

  let payload: { question?: string; data?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const question = (payload.question ?? "").trim();
  if (!question) return json({ error: "question is required" }, 400);

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\nKnown data (JSON, may be empty): ${JSON.stringify(payload.data ?? {})}\n\nUser question: ${question}\n\nReply with plain text only, no markdown, 2-4 sentences.`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.6, maxOutputTokens: 220 },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
