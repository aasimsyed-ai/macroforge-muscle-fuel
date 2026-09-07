# Workout Feature Progress

- Current phase: Phase 5/5
- Overall progress: 85%
- Current action: Phase 4 (progression/experience/notifications/WhatsApp-prep/wearable-adapter/preferences) pushed; starting Phase 5 (final review, checks, build verification, report).
- Immediate next step: confirm Lovable build green for the Phase 4 push; final pass over the whole feature; write the final report + "Required from user".

## RUNNING AUTONOMOUSLY (user is away) — decisions/assumptions log
- Mode persistence: localStorage key `macroforge-tracking-mode` (spec-named fallback; app has no global client store and mode is a per-device preference, not a shareable URL param).
- Workout tracking requires a signed-in account; guests see a "create an account" card in workout mode. Food + guest mode untouched.
- Tests live in `tests/` (outside `src/`) so they never enter the Lovable typecheck; `vitest` added as devDep + `test`/`test:watch` scripts. **Not executed here (no Node).**
- Migration is committed but NOT applied. Needs the user to paste `supabase/migrations/20260908120000_workout_tracking.sql` into Lovable Cloud → SQL editor. Recorded in "Required from user".
- `updateWorkoutSession` edits session-level fields only (no post-save exercise/set rewrite).
- WhatsApp + wearable (Mi Band / Mi Fitness): architecture + DISABLED providers only. No real sending, no fake data. Recorded in "Required from user".

## Completed
### Phase 1 — DB / RLS / RPC / types  ✅ (verified on Lovable build 3cfc1ed)
- `supabase/migrations/20260908120000_workout_tracking.sql` — 5 enums, `exercise_catalog` (+ unique functional index, ~47 seed exercises, read-only to authenticated), `workout_sessions`/`workout_exercises`/`workout_sets`, `user_training_preferences`, `notifications`, `whatsapp_preferences`, `whatsapp_message_logs`; all spec constraints; RLS `auth.uid() = user_id`; `updated_at` triggers reuse `public.set_updated_at()`; atomic `public.create_workout_session(...)` RPC (auth.uid internal, rejects unauth/no-exercise/no-set, one transaction, returns the session row).
- `src/integrations/supabase/types.ts` — hand-added 8 tables + 5 enums + `create_workout_session` fn + `Constants.public.Enums` (no reachable type-gen workflow).

### Phase 2 — types / constants / calculations / validation / API + tests  ✅ (pending Lovable build confirm)
- `src/lib/workouts/types.ts` — verbatim spec types.
- `src/lib/workouts/constants.ts` — `INDIAN_GYM_WEIGHTS_KG`, `INTENSITIES` (MET 3.5/5/7), `TRAINING_PHASES`, `MUSCLE_GROUPS`, `WEIGHT_MODES`, `DEFAULT_TRAINING_PREFERENCES`, disclaimer strings.
- `src/lib/workouts/calculations.ts` — spec reference impls: `calculateSetVolume`, `calculateSessionVolume`, `calculateWorkoutCalories` (wearable-first, never sums), `getNextAvailableWeight`, `weeksBetween`, `calculateExperienceLevel`, `analyzeExerciseProgression` (double progression, >=4 sessions & >=3 weeks & >=3 same-load, deload/maintain/ready/insufficient). Added a `sorted[0]` guard for `noUncheckedIndexedAccess`.
- `src/lib/workouts/validation.ts` — pure `validateSet` / `validateExercise` / `validateWorkoutDraft` (reps 1-1000 int, weight required for external/total/custom, bodyweight optional load, RIR 0-10, RPE 1-10, rest 0-3600, duration 0-1440, HR ranges, >=1 exercise, >=1 valid set each).
- `src/lib/workouts/api.ts` — `fetchExerciseCatalog`, `fetchWorkoutSessions`, `fetchWorkoutSessionById`, `createWorkoutSession` (computes volume + wearable-first calories, calls the RPC — no unrelated browser inserts), `updateWorkoutSession`, `deleteWorkoutSession`, `fetchTrainingPreferences` (lazy-create), `saveTrainingPreferences`, `fetchExerciseHistory` (3 plain queries + JS join -> `ProgressionHistoryItem[]`; avoids embedded selects since Relationships are `[]` in types), `fetchNotifications` / `markNotificationRead` / `markAllNotificationsRead` / `dismissNotification`. Auth via `supabase.auth.getUser()`.
- Tests: `tests/workouts/calculations.test.ts` (set/session volume, bodyweight, custom weight, wearable priority, estimate, no double-count, invalid input, experience classification, insufficient data, progression-after-weeks, deload, next weight, weeksBetween) and `tests/workouts/validation.test.ts` (workout / weight-range / RIR / RPE / rest / duration). `vitest` added as devDep + `test`/`test:watch` scripts + `vitest.config.ts` (tests live in `tests/`, outside `src/` so they don't enter the Lovable typecheck).

### Phase 3 — workout UI + dashboard integration  ✅ (pending Lovable build confirm)
- `src/lib/workouts/useTrackingMode.ts` — localStorage-backed Food/Workout mode hook.
- `src/lib/workouts/hooks.ts` — react-query hooks over api.ts (catalog, stats, session detail, create/delete workout, training preferences, exercise history, notifications).
- `src/lib/workouts/api.ts` — added `fetchWorkoutStats` (range roll-up: workouts, duration, calories with source, volume, completed sets, muscle groups, avg HR).
- `src/components/workout/`: `TrackingModeToggle`, `TrainingPhaseSelect`, `WorkoutSetEditor` (reps, load mode, preset ladder + custom weight input, bodyweight optional added load, RIR/RPE/rest, completed), `WorkoutExerciseForm` (catalog datalist, muscle group, equipment, variant, add/remove sets), `WorkoutLogger` (date/phase/intensity/duration/notes, collapsible wearable block with the "not configured" copy, live volume + single-source calorie preview, `validateWorkoutDraft` errors list, double-submit guard via ref + `isPending`), `WorkoutSummaryCards` (reuses `StatCard`), `WorkoutHistory` (expandable sessions + detail fetch + delete-with-confirm), `WorkoutDashboard` (guest gate, insufficient-data state, loading/error states).
- `src/routes/_authenticated/dashboard.tsx` — `TrackingModeToggle` above the shared range controls; `{trackingMode === "food" ? <existing food dashboard/> : <WorkoutDashboard fromDate toDate bodyWeightKg/>}`; Export CSV hidden in workout mode; body weight = latest daily metric ?? profile start weight. Food dashboard unchanged.

### Phase 4 — progression / experience / notifications / WhatsApp prep / wearable / preferences  ✅ (pending Lovable build confirm)
- `src/lib/workouts/api.ts` — `fetchRecentExerciseNames`, `fetchTrainingHistorySummary` (totalSessions, consistentWeeks via ISO-week buckets, first/last date, progression-evidence proxy = last-third mean volume > first-third × 1.05), `fetchNotificationPreferences`/`saveNotificationPreferences` (on `user_training_preferences`), `createNotificationIfAbsent` (upsert ignoreDuplicates on `user_id,dedupe_key`).
- `src/lib/workouts/notifications.ts` — pure `buildWorkoutNotifications` + `filterNotificationDrafts` (1 per category per day, 5 non-system per week, quiet-hours for non-critical, per-category enable flags, no dup category per run, stable `progression:<slug>` dedupe keys) + `isoWeekKey`/`exerciseSlug`/`isWithinQuietHours`; impure `runWorkoutNotifications` (throttled ~8h/device via localStorage, dedup in DB, runs top ~4 recent exercises through `analyzeExerciseProgression`; no notification from a single workout — `insufficient_data` is skipped).
- `src/components/workout/` — `ExperienceLevelCard` (calculateExperienceLevel + disclaimer, "Not enough data yet"), `ProgressionSuggestion` (pick a recent exercise, run analysis, badge + explanation + suggested load, insufficient-data message), `NotificationBell` (Popover + unread badge in AppShell for signed-in users) + `NotificationPanel` (list, mark read / mark all / dismiss, category badges, loading/error/empty, ScrollArea, keyboard via Popover), `NotificationPreferences` (rep-range/sets targets + 3 notification toggles + quiet hours), `WearableConnectionCard` (disabled/not-configured, honest copy), `WhatsAppSettings` (phone, opt-in toggle + consent/revoke bookkeeping, 4 category toggles, quiet hours, "delivery disabled" + the required availability sentence).
- `src/lib/wearables/{types,provider,miFitnessProvider}.ts` — `WearableProvider` interface (connect/disconnect/getConnectionStatus/syncWorkouts/syncSleep/syncHeartRate), `DisabledWearableProvider` (every sync throws `WearableNotConfiguredError`, no fake data), `miFitnessProvider` = disabled stub, `activeWearableProvider = null`. Mi Band / Mi Fitness is never presented as working.
- `src/lib/whatsapp/{types,provider,api}.ts` — `WhatsAppProvider` interface + `WhatsAppMessage` per spec, `DevelopmentWhatsAppProvider` (sendTemplateMessage throws `WhatsAppDisabledError` + logs disabled; verifyWebhook returns false; processWebhook no-op), `WHATSAPP_DELIVERY_ENABLED = false`, prefs read/write on `whatsapp_preferences`. No tokens in client code, opt-in only.
- `src/components/app/AppShell.tsx` — `NotificationBell` in the header for signed-in users.
- `src/components/workout/WorkoutDashboard.tsx` — insight cards (ProgressionSuggestion + ExperienceLevelCard) + collapsible "Training settings & notifications" (NotificationPreferences + WearableConnectionCard + WhatsAppSettings); `runWorkoutNotifications` on mount + after save.
- `tests/workouts/notifications.test.ts` — dedupe keys, per-category/day cap, weekly cap, enable flags, quiet-hours suppression, wrap-past-midnight quiet hours.

## Files changed
- A docs/workout-feature-progress.md
- A supabase/migrations/20260908120000_workout_tracking.sql
- M src/integrations/supabase/types.ts
- M src/routes/_authenticated/dashboard.tsx
- M package.json  ·  A vitest.config.ts
- A src/lib/workouts/{types,constants,calculations,validation,api,hooks,useTrackingMode}.ts
- A src/components/workout/{TrackingModeToggle,TrainingPhaseSelect,WorkoutSetEditor,WorkoutExerciseForm,WorkoutLogger,WorkoutSummaryCards,WorkoutHistory,WorkoutDashboard}.tsx
- A tests/workouts/{calculations,validation}.test.ts

## Checks completed
- Phase 1: Lovable remote build (typecheck+build) green for commit 3cfc1ed.
- Phase 2: manual TS review; Lovable build confirmation on push d39c14e.
- Phase 3: manual TS/JSX review of every component against strict tsconfig; Lovable build confirmation pending on the Phase 3 push.

## Known errors or limitations / assumptions
- No local Node toolchain -> cannot run `eslint` / `vite build` / `vitest` here. Verification of TS = Lovable remote build after each push. Unit tests are written but NOT executed in this environment; the Lovable pipeline runs `vite build`, not `vitest`. **User must run `npm run test` (after `npm i` / `bun install`) to execute them.**
- Migration is NOT applied. Lovable agent (out of credits) can't apply it and there's no direct Supabase dashboard access. **User must paste `supabase/migrations/20260908120000_workout_tracking.sql` into Lovable Cloud -> SQL editor and run it.** Until then, all workout API calls will fail against the deployed app.
- ASSUMPTION: workout tracking requires a signed-in account (RPC needs `auth.uid()`). Guest/trial users will get a "create an account" state in workout mode. Food tracking + guest mode untouched.
- ASSUMPTION: `updateWorkoutSession` edits session-level fields only (date/duration/intensity/phase/notes/HR); it does not re-write exercises/sets after creation.
- `vitest ^2.1.9` pinned; repo uses an unusual `vite 8.1.5` — if `bun install` conflicts on the Lovable build, the vitest devDep line will be removed (tests kept, run manually) and this file updated.

## Next phase
- Phase 3: `TrackingModeToggle` (localStorage `macroforge-tracking-mode`), react-query workout hooks, `WorkoutLogger` + sub-forms, `WorkoutDashboard` + summary cards + history, wire into the existing dashboard route reusing its date range; mobile + a11y + duplicate-submit guard.
