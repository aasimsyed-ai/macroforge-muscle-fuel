import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import type { WhatsAppPreferencesView } from "./types";

type Row = Database["public"]["Tables"]["whatsapp_preferences"]["Row"];
type Update = Database["public"]["Tables"]["whatsapp_preferences"]["Update"];

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in.");
  return data.user.id;
}

function toView(row: Row): WhatsAppPreferencesView {
  return {
    phoneNumber: row.phone_number,
    phoneVerified: row.phone_verified,
    notificationsEnabled: row.notifications_enabled,
    enableProgress: row.enable_progress,
    enableWorkoutGuidance: row.enable_workout_guidance,
    enableRecovery: row.enable_recovery,
    enableSafety: row.enable_safety,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    consentedAt: row.consented_at,
    revokedAt: row.revoked_at,
  };
}

export async function fetchWhatsAppPreferences(): Promise<WhatsAppPreferencesView> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("whatsapp_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return toView(data);

  const { data: created, error: insertError } = await supabase
    .from("whatsapp_preferences")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (insertError) throw insertError;
  return toView(created);
}

export async function saveWhatsAppPreferences(
  patch: Partial<WhatsAppPreferencesView>,
): Promise<WhatsAppPreferencesView> {
  const userId = await requireUserId();
  const update: Update = {};

  if (patch.phoneNumber !== undefined) update.phone_number = patch.phoneNumber?.trim() || null;
  if (patch.notificationsEnabled !== undefined)
    update.notifications_enabled = patch.notificationsEnabled;
  if (patch.enableProgress !== undefined) update.enable_progress = patch.enableProgress;
  if (patch.enableWorkoutGuidance !== undefined)
    update.enable_workout_guidance = patch.enableWorkoutGuidance;
  if (patch.enableRecovery !== undefined) update.enable_recovery = patch.enableRecovery;
  if (patch.enableSafety !== undefined) update.enable_safety = patch.enableSafety;
  if (patch.quietHoursStart !== undefined) update.quiet_hours_start = patch.quietHoursStart;
  if (patch.quietHoursEnd !== undefined) update.quiet_hours_end = patch.quietHoursEnd;

  // Editing the number always drops any prior verification.
  if (patch.phoneNumber !== undefined) update.phone_verified = false;

  // Consent bookkeeping: turning delivery on records consent, off records the revoke.
  if (patch.notificationsEnabled === true) update.consented_at = new Date().toISOString();
  if (patch.notificationsEnabled === false) update.revoked_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("whatsapp_preferences")
    .upsert({ user_id: userId, ...update }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return toView(data);
}
