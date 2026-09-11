import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = (import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined) ?? "";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    VAPID_PUBLIC_KEY.length > 0
  );
}

export function getPermissionState(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/** Converts a base64url VAPID public key into the Uint8Array pushManager.subscribe expects. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to enable push notifications.");
  return data.user.id;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  return existing ?? navigator.serviceWorker.register("/sw.js");
}

/** Full opt-in flow: register the SW, request permission, subscribe, persist. */
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notifications aren't supported in this browser.");
  }
  const userId = await requireUserId();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await getRegistration();
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const authKey = json.keys?.auth;
  if (!json.endpoint || !p256dh || !authKey) {
    throw new Error("The browser did not return a usable push subscription.");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh,
      auth_key: authKey,
      user_agent: navigator.userAgent,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ push_notifications_enabled: true })
    .eq("id", userId);
  if (profileError) throw profileError;
}

/** Reverses subscribeToPush: removes the browser subscription and its row. */
export async function unsubscribeFromPush(): Promise<void> {
  const userId = await requireUserId();

  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => undefined);
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ push_notifications_enabled: false })
    .eq("id", userId);
  if (error) throw error;
}

export interface PushPreferences {
  enabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export async function fetchPushPreferences(): Promise<PushPreferences> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("push_notifications_enabled, push_quiet_hours_start, push_quiet_hours_end")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return {
    enabled: data.push_notifications_enabled,
    quietHoursStart: data.push_quiet_hours_start,
    quietHoursEnd: data.push_quiet_hours_end,
  };
}

export async function savePushQuietHours(start: string | null, end: string | null): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("profiles")
    .update({ push_quiet_hours_start: start, push_quiet_hours_end: end })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Sends a single test push to this device via the send-push edge function.
 * That function is written but not deployed in this environment (same
 * Lovable-Cloud edge-function-deploy constraint as analyze-food) — calling
 * this before it's deployed will fail with a normal, catchable error.
 */
export async function sendTestPush(): Promise<void> {
  const { error } = await supabase.functions.invoke("send-push", {
    body: { title: "Test notification", body: "Push delivery is working." },
  });
  if (error) throw error;
}
