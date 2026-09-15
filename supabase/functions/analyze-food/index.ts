/**
 * analyze-food — Gemini vision food estimator.
 *
 * POST { imageBase64: string, mimeType?: string, description?: string, grams?: number|null }
 * ->   { calories, protein, carbs, fat, confidence, source: "vision_ai", matchedFood, note,
 *        items: [{ name, portion_g, calories, protein_g, carbs_g, fat_g }] }
 *
 * Deploy:
 *   1. Get a free key at https://aistudio.google.com/app/apikey
 *   2. supabase secrets set GEMINI_API_KEY=your_key      (or set it in the dashboard)
 *   3. supabase functions deploy analyze-food            (or paste this in the dashboard editor)
 *
 * The client falls back to its local estimator whenever this function is
 * missing, errors, or returns nothing, so it is safe to ship undeployed.
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

const PROMPT = `You are a careful nutrition estimator for a meal-logging app.
Look at the food photo and identify every distinct food or drink on the plate.
For each one estimate the eaten portion in grams and its calories, protein, carbs and fat.
Portions in a photo are uncertain — be realistic, not generous.
Return ONLY compact JSON, no markdown fences:
{"items":[{"name":"string","portion_g":number,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}],"confidence":number,"note":"string"}
confidence is 0-1 and should rarely exceed 0.6 for a photo alone.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY is not configured" }, 500);

  let payload: { imageBase64?: string; mimeType?: string; description?: string; grams?: number | null };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!payload.imageBase64) return json({ error: "imageBase64 is required" }, 400);

  const hint = [
    payload.description ? `User note: "${payload.description}".` : "",
    payload.grams ? `Approximate total serving: ${Math.round(payload.grams)} g.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: hint ? `${PROMPT}\n${hint}` : PROMPT },
          { inline_data: { mime_type: payload.mimeType || "image/jpeg", data: payload.imageBase64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };

  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
  } catch (e) {
    return json({ error: `gemini request failed: ${String(e)}` }, 502);
  }
  if (!geminiRes.ok) {
    return json({ error: `gemini ${geminiRes.status}`, detail: await geminiRes.text() }, 502);
  }

  const data = await geminiRes.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  let parsed: { items?: unknown; confidence?: unknown; note?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      return json({ error: "could not parse model output", raw: text }, 502);
    }
  }

  const rawItems = Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : [];
  const names =
    rawItems
      .map((it) => String(it["name"] ?? "").trim())
      .filter(Boolean)
      .join(" + ") || "meal from photo";
  const round1 = (n: number) => Math.round(n * 10) / 10;

  // Round per item first, then sum the rounded values — so the itemized list
  // returned below always adds up to exactly the totals returned alongside it.
  const items = rawItems.map((it) => ({
    name: String(it["name"] ?? "").trim() || "food",
    portion_g: Number(it["portion_g"]) || null,
    calories: Math.round(Number(it["calories"]) || 0),
    protein_g: round1(Number(it["protein_g"]) || 0),
    carbs_g: round1(Number(it["carbs_g"]) || 0),
    fat_g: round1(Number(it["fat_g"]) || 0),
  }));
  const sum = (key: "calories" | "protein_g" | "carbs_g" | "fat_g") =>
    items.reduce((acc, it) => acc + it[key], 0);

  return json({
    calories: Math.round(sum("calories")),
    protein: round1(sum("protein_g")),
    carbs: round1(sum("carbs_g")),
    fat: round1(sum("fat_g")),
    confidence: Math.max(0, Math.min(0.7, Number(parsed.confidence) || 0.45)),
    source: "vision_ai",
    matchedFood: names,
    note:
      (typeof parsed.note === "string" && parsed.note ? `${parsed.note}. ` : "") +
      "AI photo estimate — approximate, please check the numbers before saving.",
    // Per-item breakdown so the client can show an editable itemized list
    // instead of only the summed total.
    items,
  });
});
