import type { EmailOtpType } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email",
  "email_change",
];

/**
 * Turns whatever Supabase redirected back with into a session. Hash tokens
 * (implicit flow) are consumed by the client itself; `?token_hash` and
 * `?code` links are NOT, so they are exchanged here explicitly — otherwise a
 * verified user lands in the app with no session and is asked to sign in again.
 * Returns an error message, or null if a session now exists.
 */
export async function completeAuthCallback(search: string, hash: string): Promise<string | null> {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const tokenHash = query.get("token_hash");
  const code = query.get("code");

  if (tokenHash) {
    const type = (query.get("type") ?? "signup") as EmailOtpType;
    if (!OTP_TYPES.includes(type)) return "That link is not valid. Please sign in.";
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return error.message;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return error.message;
  } else if (fragment.get("access_token") && fragment.get("refresh_token")) {
    const { error } = await supabase.auth.setSession({
      access_token: fragment.get("access_token") as string,
      refresh_token: fragment.get("refresh_token") as string,
    });
    if (error) return error.message;
  }

  const { data } = await supabase.auth.getSession();
  return data.session ? null : "We couldn't complete sign-in from that link. Please sign in.";
}
