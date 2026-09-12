-- Real Web Push infrastructure: per-device subscriptions + per-user push
-- preferences. Additive only — no existing table is altered in a breaking
-- way, no data is deleted. Safe to run more than once.
--
-- NOT APPLIED YET. Written for review; run in Lovable Cloud -> SQL editor
-- (or via the same query_database path used for the workout migration) only
-- after explicit approval, same as every other migration in this project.

-- ============================================================ profiles: push preferences
-- Nullable/defaulted additions only — every existing row is valid as-is.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_quiet_hours_start TIME;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_quiet_hours_end TIME;

-- ============================================================ push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- No policy for anon/service_role beyond the above: the send-push edge
-- function reads this table with the service_role key, which bypasses RLS
-- by design (that's the only way a server-side sender can read subscriptions
-- across users) — it never accepts a client-supplied user id for that read.
