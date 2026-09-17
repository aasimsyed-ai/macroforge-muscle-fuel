-- Adds three requested back exercises to the shared exercise catalog. Relies
-- on the existing exercise_catalog_unique_idx (lower(muscle_group), lower(name),
-- lower(variant), lower(equipment)) for ON CONFLICT DO NOTHING, same pattern
-- as the original seed in 20260908120000_workout_tracking.sql.
INSERT INTO public.exercise_catalog (muscle_group, name, is_bodyweight) VALUES
  ('Back', 'Pec Fly Rear Delt', false),
  ('Back', 'Seated Rowing Machine', false),
  ('Back', 'Standing Lat Pulldown', false)
ON CONFLICT DO NOTHING;
