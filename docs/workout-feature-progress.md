# Workout Feature Progress

- Current phase: Phase 1/5
- Overall progress: 10%
- Current action: DB migration + Supabase types written; awaiting user to run the SQL in Lovable Cloud → SQL editor, and awaiting Lovable remote build to confirm types compile.
- Immediate next step: verify Lovable build is green for the types change, then start Phase 2 (workout types/constants/calculations/API + unit tests).

## Completed
- Repo inspected: TanStack Start + Supabase, no test runner (added vitest in Phase 2), only `lint`/`build` scripts, no local Node toolchain (rely on Lovable remote build for typecheck).
- Reuse targets identified: `src/routes/_authenticated/dashboard.tsx` (range selector `RANGE_OPTIONS`/`resolveRange` in `src/lib/nutrition.ts`), `src/components/app/AppShell.tsx`, `src/lib/data.ts` (query/mutation hook pattern), `src/lib/guest.ts` (guest gate), shadcn/ui primitives, `src/components/app/MetricsQuickLog.tsx` (form pattern).
- Migration `supabase/migrations/20260908120000_workout_tracking.sql`: 5 enums, `exercise_catalog` (+ unique functional index + ~55 seed rows), `workout_sessions`, `workout_exercises`, `workout_sets`, `user_training_preferences`, `notifications`, `whatsapp_preferences`, `whatsapp_message_logs`; all constraints from the spec; RLS `auth.uid() = user_id` on every user-owned table; `exercise_catalog` read-only to authenticated; `updated_at` triggers via existing `public.set_updated_at()`; atomic `public.create_workout_session(...)` RPC (reads `auth.uid()`, JSONB exercises/sets, one transaction, rejects unauth / no-exercise / no-set).
- `src/integrations/supabase/types.ts`: hand-added the 8 tables, 5 enums, and the `create_workout_session` function signature (pragmatic exception to "regenerate" — no type-gen workflow reachable in this environment).

## Files changed
- A `docs/workout-feature-progress.md`
- A `supabase/migrations/20260908120000_workout_tracking.sql`
- M `src/integrations/supabase/types.ts`

## Checks completed
- Manual review of migration against existing `20260825145434_*.sql` style (public schema, GRANT to authenticated + service_role, RLS FOR ALL policies, `set_updated_at()` reuse).
- Pending: Lovable remote build (typecheck) on the types.ts change.

## Known errors or limitations
- Cannot run `eslint`/`vite build`/tests locally (no Node). Verification = `eslint .` result is unavailable locally; Lovable remote `vite build` after push is the typecheck signal.
- The migration must be run by the user in Lovable Cloud → SQL editor (Lovable agent out of credits; no direct Supabase dashboard access). Nothing that depends on the new tables will work in the deployed app until that SQL is run.
- Workout tracking requires a signed-in account (RPC needs `auth.uid()`); guest/trial users will see a "create an account" state in workout mode. Food tracking / guest mode unchanged.

## Next phase
- Phase 2: `src/lib/workouts/{types,constants,calculations,api}.ts` + `src/lib/workouts/__tests__/*.test.ts` (vitest); wire `vitest` devDep + `test` script.
