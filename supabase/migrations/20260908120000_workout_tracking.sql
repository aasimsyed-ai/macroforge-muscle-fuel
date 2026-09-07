-- Workout tracking feature: enums, catalog, sessions/exercises/sets, training
-- preferences, notifications, WhatsApp prep, RLS, triggers, seed, atomic RPC.
-- Safe to run more than once.

-- ============================================================ enums
DO $$ BEGIN
  CREATE TYPE public.workout_intensity AS ENUM ('light','moderate','vigorous');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.training_phase AS ENUM
    ('hypertrophy','strength','fat_loss','general_fitness','endurance','maintenance','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.experience_level AS ENUM ('beginner','intermediate','advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.workout_data_source AS ENUM ('manual','wearable','estimated','imported');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_category AS ENUM
    ('progress','motivation','workout_guidance','progression','nutrition','recovery','safety','wearable','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================ exercise_catalog
CREATE TABLE IF NOT EXISTS public.exercise_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muscle_group TEXT NOT NULL,
  name TEXT NOT NULL,
  variant TEXT,
  equipment TEXT,
  is_bodyweight BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS exercise_catalog_unique_idx ON public.exercise_catalog
  (lower(muscle_group), lower(name), lower(coalesce(variant, '')), lower(coalesce(equipment, '')));
CREATE INDEX IF NOT EXISTS exercise_catalog_muscle_idx ON public.exercise_catalog (muscle_group) WHERE is_active;

GRANT SELECT ON public.exercise_catalog TO authenticated;
GRANT ALL ON public.exercise_catalog TO service_role;
ALTER TABLE public.exercise_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercise catalog read" ON public.exercise_catalog;
CREATE POLICY "exercise catalog read" ON public.exercise_catalog
  FOR SELECT TO authenticated USING (true);
-- No INSERT/UPDATE/DELETE policy => regular users cannot modify the catalog.

-- ============================================================ workout_sessions
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  intensity public.workout_intensity,
  training_phase public.training_phase,
  estimated_calories_burned NUMERIC(8,2),
  wearable_calories_burned NUMERIC(8,2),
  calories_source public.workout_data_source,
  average_heart_rate INTEGER,
  max_heart_rate INTEGER,
  total_volume NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  source public.workout_data_source NOT NULL DEFAULT 'manual',
  external_source TEXT,
  external_workout_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workout_sessions_duration_chk CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 1440),
  CONSTRAINT workout_sessions_est_cal_chk CHECK (estimated_calories_burned IS NULL OR estimated_calories_burned >= 0),
  CONSTRAINT workout_sessions_wear_cal_chk CHECK (wearable_calories_burned IS NULL OR wearable_calories_burned >= 0),
  CONSTRAINT workout_sessions_avg_hr_chk CHECK (average_heart_rate IS NULL OR average_heart_rate BETWEEN 30 AND 240),
  CONSTRAINT workout_sessions_max_hr_chk CHECK (max_heart_rate IS NULL OR max_heart_rate BETWEEN 30 AND 260),
  CONSTRAINT workout_sessions_volume_chk CHECK (total_volume >= 0)
);
CREATE INDEX IF NOT EXISTS workout_sessions_user_date_idx ON public.workout_sessions (user_id, workout_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_external_idx ON public.workout_sessions
  (user_id, external_source, external_workout_id) WHERE external_workout_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own workout sessions" ON public.workout_sessions;
CREATE POLICY "own workout sessions" ON public.workout_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================ workout_exercises
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_catalog_id UUID REFERENCES public.exercise_catalog(id),
  muscle_group TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  exercise_variant TEXT,
  equipment TEXT,
  exercise_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_exercises_session_idx ON public.workout_exercises (session_id);
CREATE INDEX IF NOT EXISTS workout_exercises_user_name_idx ON public.workout_exercises (user_id, lower(exercise_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own workout exercises" ON public.workout_exercises;
CREATE POLICY "own workout exercises" ON public.workout_exercises
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================ workout_sets
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg NUMERIC(8,2),
  weight_mode TEXT NOT NULL DEFAULT 'external',
  rir NUMERIC(4,1),
  rpe NUMERIC(4,1),
  completed BOOLEAN NOT NULL DEFAULT true,
  rest_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workout_sets_set_number_chk CHECK (set_number > 0),
  CONSTRAINT workout_sets_reps_chk CHECK (reps BETWEEN 1 AND 1000),
  CONSTRAINT workout_sets_weight_chk CHECK (weight_kg IS NULL OR weight_kg >= 0),
  CONSTRAINT workout_sets_weight_mode_chk CHECK (weight_mode IN ('external','bodyweight','total','custom')),
  CONSTRAINT workout_sets_rir_chk CHECK (rir IS NULL OR rir BETWEEN 0 AND 10),
  CONSTRAINT workout_sets_rpe_chk CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  CONSTRAINT workout_sets_rest_chk CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600),
  CONSTRAINT workout_sets_unique_number UNIQUE (workout_exercise_id, set_number)
);
CREATE INDEX IF NOT EXISTS workout_sets_exercise_idx ON public.workout_sets (workout_exercise_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sets TO authenticated;
GRANT ALL ON public.workout_sets TO service_role;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own workout sets" ON public.workout_sets;
CREATE POLICY "own workout sets" ON public.workout_sets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================ user_training_preferences
CREATE TABLE IF NOT EXISTS public.user_training_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  training_phase public.training_phase NOT NULL DEFAULT 'hypertrophy',
  experience_level public.experience_level,
  progression_mode TEXT NOT NULL DEFAULT 'double_progression',
  target_min_reps INTEGER NOT NULL DEFAULT 8,
  target_max_reps INTEGER NOT NULL DEFAULT 12,
  target_sets INTEGER NOT NULL DEFAULT 3,
  minimum_sessions_for_suggestion INTEGER NOT NULL DEFAULT 4,
  minimum_weeks_for_suggestion INTEGER NOT NULL DEFAULT 3,
  enable_progression_notifications BOOLEAN NOT NULL DEFAULT true,
  enable_motivation_notifications BOOLEAN NOT NULL DEFAULT true,
  enable_health_notifications BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_training_preferences_progression_mode_chk
    CHECK (progression_mode IN ('double_progression','weight_first','reps_first')),
  CONSTRAINT user_training_preferences_reps_chk
    CHECK (target_min_reps > 0 AND target_max_reps >= target_min_reps AND target_max_reps <= 100),
  CONSTRAINT user_training_preferences_sets_chk CHECK (target_sets > 0 AND target_sets <= 20)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_training_preferences TO authenticated;
GRANT ALL ON public.user_training_preferences TO service_role;
ALTER TABLE public.user_training_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own training preferences" ON public.user_training_preferences;
CREATE POLICY "own training preferences" ON public.user_training_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================ notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.notification_category NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dedupe_key TEXT,
  related_workout_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  related_exercise_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT notifications_priority_chk CHECK (priority IN ('low','normal','high','critical'))
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON public.notifications
  (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notifications" ON public.notifications;
CREATE POLICY "own notifications" ON public.notifications
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================ whatsapp_preferences (architecture prep)
CREATE TABLE IF NOT EXISTS public.whatsapp_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  enable_progress BOOLEAN NOT NULL DEFAULT true,
  enable_workout_guidance BOOLEAN NOT NULL DEFAULT true,
  enable_recovery BOOLEAN NOT NULL DEFAULT true,
  enable_safety BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  consented_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_preferences TO authenticated;
GRANT ALL ON public.whatsapp_preferences TO service_role;
ALTER TABLE public.whatsapp_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own whatsapp preferences" ON public.whatsapp_preferences;
CREATE POLICY "own whatsapp preferences" ON public.whatsapp_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================ whatsapp_message_logs (architecture prep)
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  template_name TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_message_logs_status_chk
    CHECK (status IN ('queued','sent','delivered','read','failed','skipped'))
);
CREATE INDEX IF NOT EXISTS whatsapp_message_logs_user_idx ON public.whatsapp_message_logs (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_message_logs TO authenticated;
GRANT ALL ON public.whatsapp_message_logs TO service_role;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own whatsapp logs" ON public.whatsapp_message_logs;
CREATE POLICY "own whatsapp logs" ON public.whatsapp_message_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================ updated_at triggers (reuse existing fn)
DROP TRIGGER IF EXISTS workout_sessions_updated_at ON public.workout_sessions;
CREATE TRIGGER workout_sessions_updated_at BEFORE UPDATE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS user_training_preferences_updated_at ON public.user_training_preferences;
CREATE TRIGGER user_training_preferences_updated_at BEFORE UPDATE ON public.user_training_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS whatsapp_preferences_updated_at ON public.whatsapp_preferences;
CREATE TRIGGER whatsapp_preferences_updated_at BEFORE UPDATE ON public.whatsapp_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================ atomic workout creation RPC
CREATE OR REPLACE FUNCTION public.create_workout_session(
  p_workout_date DATE,
  p_duration_minutes INTEGER,
  p_intensity public.workout_intensity,
  p_training_phase public.training_phase,
  p_estimated_calories_burned NUMERIC,
  p_wearable_calories_burned NUMERIC,
  p_calories_source public.workout_data_source,
  p_average_heart_rate INTEGER,
  p_max_heart_rate INTEGER,
  p_total_volume NUMERIC,
  p_notes TEXT,
  p_exercises JSONB
)
RETURNS public.workout_sessions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.workout_sessions;
  v_exercise JSONB;
  v_set JSONB;
  v_exercise_id UUID;
  v_order INTEGER := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_exercises IS NULL
     OR jsonb_typeof(p_exercises) <> 'array'
     OR jsonb_array_length(p_exercises) = 0 THEN
    RAISE EXCEPTION 'A workout must include at least one exercise' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.workout_sessions (
    user_id, workout_date, duration_minutes, intensity, training_phase,
    estimated_calories_burned, wearable_calories_burned, calories_source,
    average_heart_rate, max_heart_rate, total_volume, notes, source
  ) VALUES (
    v_user,
    COALESCE(p_workout_date, CURRENT_DATE),
    p_duration_minutes, p_intensity, p_training_phase,
    p_estimated_calories_burned, p_wearable_calories_burned, p_calories_source,
    p_average_heart_rate, p_max_heart_rate, COALESCE(p_total_volume, 0),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    'manual'
  )
  RETURNING * INTO v_session;

  FOR v_exercise IN SELECT * FROM jsonb_array_elements(p_exercises)
  LOOP
    IF v_exercise->'sets' IS NULL
       OR jsonb_typeof(v_exercise->'sets') <> 'array'
       OR jsonb_array_length(v_exercise->'sets') = 0 THEN
      RAISE EXCEPTION 'Each exercise must include at least one set' USING ERRCODE = '22023';
    END IF;

    v_order := v_order + 1;

    INSERT INTO public.workout_exercises (
      session_id, user_id, exercise_catalog_id, muscle_group, exercise_name,
      exercise_variant, equipment, exercise_order, notes
    ) VALUES (
      v_session.id,
      v_user,
      NULLIF(v_exercise->>'exerciseCatalogId', '')::UUID,
      COALESCE(NULLIF(btrim(v_exercise->>'muscleGroup'), ''), 'Other'),
      COALESCE(NULLIF(btrim(v_exercise->>'exerciseName'), ''), 'Exercise'),
      NULLIF(btrim(v_exercise->>'exerciseVariant'), ''),
      NULLIF(btrim(v_exercise->>'equipment'), ''),
      v_order,
      NULLIF(btrim(v_exercise->>'notes'), '')
    )
    RETURNING id INTO v_exercise_id;

    FOR v_set IN SELECT * FROM jsonb_array_elements(v_exercise->'sets')
    LOOP
      INSERT INTO public.workout_sets (
        workout_exercise_id, user_id, set_number, reps, weight_kg, weight_mode,
        rir, rpe, completed, rest_seconds, notes
      ) VALUES (
        v_exercise_id,
        v_user,
        COALESCE((v_set->>'setNumber')::INTEGER, v_order),
        (v_set->>'reps')::INTEGER,
        NULLIF(v_set->>'weightKg', '')::NUMERIC,
        COALESCE(NULLIF(v_set->>'weightMode', ''), 'external'),
        NULLIF(v_set->>'rir', '')::NUMERIC,
        NULLIF(v_set->>'rpe', '')::NUMERIC,
        COALESCE((v_set->>'completed')::BOOLEAN, true),
        NULLIF(v_set->>'restSeconds', '')::INTEGER,
        NULLIF(btrim(v_set->>'notes'), '')
      );
    END LOOP;
  END LOOP;

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.create_workout_session(
  DATE, INTEGER, public.workout_intensity, public.training_phase, NUMERIC, NUMERIC,
  public.workout_data_source, INTEGER, INTEGER, NUMERIC, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workout_session(
  DATE, INTEGER, public.workout_intensity, public.training_phase, NUMERIC, NUMERIC,
  public.workout_data_source, INTEGER, INTEGER, NUMERIC, TEXT, JSONB
) TO authenticated;

-- ============================================================ seed exercise catalog
INSERT INTO public.exercise_catalog (muscle_group, name, is_bodyweight) VALUES
  ('Chest','Barbell Bench Press',false),
  ('Chest','Incline Barbell Bench Press',false),
  ('Chest','Dumbbell Bench Press',false),
  ('Chest','Incline Dumbbell Press',false),
  ('Chest','Chest Fly',false),
  ('Chest','Cable Crossover',false),
  ('Chest','Push-Up',true),
  ('Back','Lat Pulldown',false),
  ('Back','Pull-Up',true),
  ('Back','Assisted Pull-Up',true),
  ('Back','Barbell Row',false),
  ('Back','Seated Cable Row',false),
  ('Back','One-Arm Dumbbell Row',false),
  ('Shoulders','Overhead Press',false),
  ('Shoulders','Dumbbell Shoulder Press',false),
  ('Shoulders','Lateral Raise',false),
  ('Shoulders','Rear Delt Fly',false),
  ('Shoulders','Face Pull',false),
  ('Biceps','Barbell Curl',false),
  ('Biceps','Dumbbell Curl',false),
  ('Biceps','Hammer Curl',false),
  ('Biceps','Cable Curl',false),
  ('Triceps','Triceps Pushdown',false),
  ('Triceps','Overhead Triceps Extension',false),
  ('Triceps','Skull Crusher',false),
  ('Triceps','Close-Grip Bench Press',false),
  ('Legs','Barbell Squat',false),
  ('Legs','Goblet Squat',false),
  ('Legs','Leg Press',false),
  ('Legs','Romanian Deadlift',false),
  ('Legs','Leg Curl',false),
  ('Legs','Leg Extension',false),
  ('Legs','Bulgarian Split Squat',false),
  ('Legs','Walking Lunge',false),
  ('Legs','Calf Raise',false),
  ('Glutes','Hip Thrust',false),
  ('Glutes','Glute Bridge',true),
  ('Glutes','Cable Kickback',false),
  ('Core','Plank',true),
  ('Core','Hanging Knee Raise',true),
  ('Core','Hanging Leg Raise',true),
  ('Core','Cable Crunch',false),
  ('Core','Ab Wheel Rollout',true),
  ('Full Body','Deadlift',false),
  ('Full Body','Kettlebell Swing',false),
  ('Full Body','Farmer Carry',false),
  ('Full Body','Burpee',true)
ON CONFLICT DO NOTHING;
