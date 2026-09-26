/**
 * Pure auth-state helpers. Kept free of Supabase/React so the rules that
 * decide "logged in vs. restoring vs. logged out" — and how a verification /
 * magic-link redirect is recognised — are unit-testable.
 */

export type AuthView = "restoring" | "authenticated" | "unauthenticated";

/**
 * A session that has not finished restoring is NOT a logged-out user. An
 * existing session always wins; "no session" only counts once restoring
 * has finished.
 */
export function resolveAuthView(state: { loading: boolean; hasSession: boolean }): AuthView {
  if (state.hasSession) return "authenticated";
  if (state.loading) return "restoring";
  return "unauthenticated";
}

export type AuthCallback =
  { kind: "none" } | { kind: "pending" } | { kind: "error"; message: string };

/**
 * Inspects the URL Supabase redirected back to. Tokens/codes mean a callback
 * is being processed (the client establishes the session itself); an
 * error_description means the link was expired/invalid and must be reported,
 * never silently dropped.
 */
export function parseAuthCallback(search: string, hash: string): AuthCallback {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const get = (key: string) => fragment.get(key) ?? query.get(key);

  const errorDescription = get("error_description");
  const errorCode = get("error_code") ?? get("error");
  if (errorDescription || errorCode) {
    const expired = errorCode === "otp_expired" || /expired|invalid/i.test(errorDescription ?? "");
    return {
      kind: "error",
      message: expired
        ? "That link has expired or was already used. Sign in, or request a new link."
        : (errorDescription ?? "Verification failed. Please try again.").replace(/\+/g, " "),
    };
  }
  if (get("access_token") || get("code") || get("token_hash")) return { kind: "pending" };
  return { kind: "none" };
}
