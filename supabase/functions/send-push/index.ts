/**
 * send-push — real Web Push delivery, invoked on demand (no automatic
 * trigger is wired anywhere in the app). Sends only to the CALLING user's
 * own subscriptions — this is a "send me a test" endpoint, not a broadcast
 * mechanism, so it only ever needs the caller's own JWT-scoped access
 * (RLS already limits push_subscriptions reads to `auth.uid() = user_id`;
 * no service-role key is used here).
 *
 * SAFETY: sending is fully gated behind the PUSH_DELIVERY_ENABLED secret.
 * Until that is explicitly set to "true" in Supabase secrets, every call
 * returns { sent: false, reason: "delivery_disabled" } and nothing is sent —
 * mirrors the existing WHATSAPP_DELIVERY_ENABLED pattern in this codebase.
 * Do not flip this on without the user's explicit approval.
 *
 * Deploy (same path as analyze-food — this project's edge functions are
 * deployed via the Lovable agent, not a local CLI):
 *   1. supabase secrets set VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...
 *      VAPID_SUBJECT=mailto:you@example.com
 *   2. (leave PUSH_DELIVERY_ENABLED unset / "false" until approved)
 *   3. supabase functions deploy send-push
 *
 * POST { title?: string, body?: string, url?: string }
 * -> { sent: boolean, delivered: number, failed: number, reason?: string }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const deliveryEnabled = Deno.env.get("PUSH_DELIVERY_ENABLED") === "true";

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !authHeader) {
    return json({ error: "missing auth context" }, 401);
  }

  // Scoped to the caller's own JWT — reads only their own rows, per RLS.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "not authenticated" }, 401);
  }

  if (!deliveryEnabled) {
    return json({ sent: false, delivered: 0, failed: 0, reason: "delivery_disabled" });
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return json({ error: "VAPID keys are not configured" }, 500);
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let payload: { title?: string; body?: string; url?: string };
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key");
  if (subsError) return json({ error: subsError.message }, 500);
  if (!subs || subs.length === 0) {
    return json({ sent: false, delivered: 0, failed: 0, reason: "no_subscriptions" });
  }

  const message = JSON.stringify({
    title: payload.title || "MacroForge",
    body: payload.body || "",
    url: payload.url || "/dashboard",
  });

  let delivered = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        message,
      );
      delivered += 1;
    } catch (err) {
      failed += 1;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      // 404/410 mean the browser dropped this subscription — clean it up.
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return json({ sent: delivered > 0, delivered, failed });
});
