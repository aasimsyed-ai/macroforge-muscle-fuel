-- Saved Meals / Recipes: user-curated, reusable meal templates. Distinct
-- from `meals` (a logged instance) — this is a template a user explicitly
-- saves once and reapplies many times. One row per named template; saving
-- again under the same (case-insensitive) name updates it rather than
-- creating a duplicate.
CREATE TABLE public.meal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'snack',
  serving_amount TEXT,
  calories NUMERIC(7,1) NOT NULL DEFAULT 0,
  protein_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  fat_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  is_estimate BOOLEAN NOT NULL DEFAULT false,
  estimate_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meal_templates_category_check CHECK (category IN ('breakfast','lunch','pre_workout','post_workout','dinner','snack')),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_templates TO authenticated;
GRANT ALL ON public.meal_templates TO service_role;
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meal templates" ON public.meal_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX meal_templates_user_idx ON public.meal_templates (user_id);

CREATE TRIGGER meal_templates_updated_at BEFORE UPDATE ON public.meal_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
