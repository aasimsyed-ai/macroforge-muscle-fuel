# Workout Feature Progress

- Current phase: Phase 5/5 — COMPLETE, migration applied, live in production, audited.
- Overall progress: 100%. Migration is applied (2026-09-11) and the feature is live end-to-end.
- Current action: none — final audit (2026-09-11) complete, bugs fixed, deployed and verified.

## Post-launch audit — 2026-09-11
Full bug hunt / gap analysis across the workout feature per user request. No local Node toolchain in this environment, so correctness was verified by manual code review plus Lovable's remote `vite build` (the project's only typecheck signal) — green at commit `f16dfa2`.

**Bugs found and fixed:**
1. **Stale weight-input widget after "copy from a previous workout."** `WorkoutSetEditor`'s custom-vs-preset weight toggle was a `useState` lazy initializer with no re-sync, and `WorkoutExerciseForm`/`WorkoutSetEditor` were keyed by array index. Copying a previous session replaces `draft.exercises` in place (same keys), so a copied set with a non-ladder weight (e.g. 27.5 kg) could render the preset dropdown showing "Select weight" while the real value was already 27.5 — correct data, wrong widget. Fixed in `WorkoutLogger.tsx` by adding a `draftVersion` counter bumped on copy and on post-save reset, folded into the exercise list's `key`, forcing a clean remount (and fresh local UI state) whenever the draft is replaced wholesale.
2. **Notification "one per category per day" cap reset at UTC midnight, not the viewer's local midnight.** `filterNotificationDrafts` computed `todayKey` via `.toISOString().slice(0,10)`. Fixed in `notifications.ts` with a `localDateKey()` helper using local `Date` components; updated `tests/workouts/notifications.test.ts` (one fixture's `created_at` was UTC-Z and depended on the runner's timezone to land on the right day — changed to a local, unambiguous same-day timestamp).

**Confirmed correct, not bugs (checked because the audit asked):**
- Calorie double-counting: `calculateWorkoutCalories` always returns exactly one source (wearable XOR estimated), never summed.
- Orphaned rows on delete: all three child tables (`workout_exercises`, `workout_sets`, plus `notifications.related_workout_id`) use `ON DELETE CASCADE`/`SET NULL` — deleting a session cannot leave orphans.
- RLS: every workout table has `auth.uid() = user_id` policies; `create_workout_session` reads `auth.uid()` server-side and never trusts a client-supplied user id; `exercise_catalog` is read-only to authenticated users.
- "Insufficient data" messaging: each failure path in `analyzeExerciseProgression` returns a distinct, specific explanation string, surfaced as-is in `ProgressionSuggestion`.
- Tracking-mode persistence: `useTrackingMode` correctly persists to `localStorage` and restores on refresh (starts as `"food"` for one frame by design, to keep SSR/first client render in sync, then corrects in an effect — documented in the code, not a bug).
- Indexes: all hot query paths (`workout_sessions` by user+date, `workout_exercises` by session and by user+lower(name), `workout_sets` by exercise, `notifications` by user+date and the dedupe key) are covered.

**Architectural gap found, not auto-fixed (flagged only — touches existing food-tracking UI the spec says not to redesign):**
- `daily_metrics.workout_minutes` / `workout_type` (a free-text quick-log pair from the original food-tracking MVP, still shown in the Food dashboard's daily quick log) is completely disconnected from the new structured Workout Tracking feature. Two unrelated places now record "I worked out" with no reconciliation. Left as-is and reported to the user as a recommended next step, since resolving it means changing existing food-tracking UI/behavior.

**Minor, low-priority, not fixed:** `fetchExerciseHistory`'s `.ilike(exercise_name, name)` won't necessarily use the `lower(exercise_name)` functional index at large per-user row counts (ILIKE vs. an `=`-on-`lower()` predicate). Irrelevant at the personal-tracker scale this app runs at today; worth a look only if exercise history ever gets slow.

## Edit a saved workout — added 2026-09-12
User reported no way to edit a submitted workout (only view/delete existed). Added:
- `sessionDetailToDraft()` in `api.ts` — turns a saved `WorkoutSessionDetail` back into a full `WorkoutSessionDraft` (date, phase, intensity, duration, notes, wearable fields inferred from `calories_source`, plus every exercise/set via the existing `sessionDetailToExerciseDrafts`).
- `replaceWorkoutSession()` in `api.ts` + `useReplaceWorkout` hook — the create RPC only appends, so an edit is create-the-replacement-then-delete-the-original, in that order, so a failed delete never loses data (worst case: a harmless duplicate).
- `WorkoutLogger` now accepts an optional `initialData={{ sessionId, draft }}` prop; when set it pre-fills the form, calls `replaceWorkoutSession` instead of `createWorkoutSession` on submit, shows "Save changes" instead of "Save workout", and skips the "copy from previous" picker.
- `WorkoutHistory` gained a pencil/edit icon button per row (next to delete) that expands an inline `WorkoutLogger` pre-filled with that session's data.
- **Bug fixed along the way**: `sessionDetailToExerciseDrafts` hardcoded every restored set's `completed` to `true`, silently un-skipping any set the user had marked incomplete. Now preserves the real value — matters for both this edit feature and the existing "copy a previous workout" feature.
- Deployed and verified live (bundle `dashboard-H6AGQALW.js`).

## QA fix pass — 2026-09-12
- `replaceWorkoutSession()` now reports a failed delete instead of silently swallowing it: it returns `{ session, oldSessionRemoved }`, and `WorkoutLogger` shows a warning toast ("...old entry couldn't be removed. Please check Workout History.") when `oldSessionRemoved` is `false`, so a leftover duplicate is never invisible to the user.
- Guests hitting the standalone `/log-workout` route (nav shortcut) now see the same "Workout tracking needs an account" notice `WorkoutDashboard` already showed, instead of being able to fill in a full workout form that only fails at save time. Extracted the shared markup into `WorkoutAccountRequired.tsx` so both surfaces use one component.
- `StrengthMiniTrend` no longer queries `useRecentSessionVolumes` for guests (who never have workout data) — added an `enabled` option to the hook, mirroring the existing pattern on `useMeals`/`useMetrics`/`useWorkoutStats`.
- Landing page copy no longer implies workout tracking works without an account, and the "photo-assisted" feature blurb now reflects that a food name is required (a photo alone isn't enough).

## Phase status
| Phase | Scope | State | Verified |
|---|---|---|---|
| 1/5 | Repo inspect, migration, RLS, RPC, Supabase types | ✅ | Lovable build green — commit `3cfc1ed` |
| 2/5 | Types, constants, calculations, validation, API, unit tests | ✅ | Lovable build green — `d39c14e` |
| 3/5 | Mode toggle, logger, forms, workout dashboard, dashboard integration | ✅ | Lovable build green — `05893db` |
| 4/5 | Progression, experience, notifications, WhatsApp prep, wearable adapter, preferences | ✅ | Lovable build green — `f909949` |
| 5/5 | Checks, type-check, build, deploy, final verification | ✅ | Lovable build green + production deploy of `f909949` |

## What each phase delivered
### Phase 1
- `supabase/migrations/20260908120000_workout_tracking.sql` (safe to re-run): 5 enums (`workout_intensity`, `training_phase`, `experience_level`, `workout_data_source`, `notification_category`); tables `exercise_catalog` (unique functional index on lower(muscle_group)/name/variant/equipment; ~47 seed exercises; read-only to `authenticated`, no write policy), `workout_sessions`, `workout_exercises`, `workout_sets`, `user_training_preferences`, `notifications`, `whatsapp_preferences`, `whatsapp_message_logs`; every spec CHECK constraint; unique partial indexes (external workout id, notification dedupe key); RLS `auth.uid() = user_id` on all user tables; `updated_at` triggers via the existing `public.set_updated_at()`; atomic `public.create_workout_session(p_workout_date, p_duration_minutes, p_intensity, p_training_phase, p_estimated_calories_burned, p_wearable_calories_burned, p_calories_source, p_average_heart_rate, p_max_heart_rate, p_total_volume, p_notes, p_exercises jsonb)` — reads `auth.uid()`, rejects unauthenticated / no-exercise / no-set, one transaction, `EXECUTE` granted to `authenticated` only.
- `src/integrations/supabase/types.ts` — hand-added the 8 tables + 5 enums + the RPC signature + `Constants.public.Enums` (no reachable type-gen workflow; documented exception to "regenerate").

### Phase 2
- `src/lib/workouts/types.ts` (spec types), `constants.ts` (Indian gym weight ladder, MET table, phases, muscle groups, weight modes, default preferences, disclaimer strings), `calculations.ts` (pure: set/session volume — bodyweight & incomplete = 0; wearable-first calorie estimate that never sums the two; `getNextAvailableWeight`; `weeksBetween`; `calculateExperienceLevel`; `analyzeExerciseProgression` double-progression with the ≥4 sessions / ≥3 weeks / ≥3 same-load minimums → `ready_to_progress` | `maintain` | `deload_or_recover` | `insufficient_data`), `validation.ts` (pure workout/exercise/set validation).
- `src/lib/workouts/api.ts` — catalog, sessions CRUD, `createWorkoutSession` (client computes total volume + wearable-first calories, then calls the RPC once — no unrelated browser inserts, never sends a client `user_id`), `fetchTrainingPreferences` (lazy-create) / `saveTrainingPreferences`, `fetchExerciseHistory` (3 plain queries + JS join → `ProgressionHistoryItem[]`; avoids embedded selects), notification read/dismiss.
- `tests/workouts/calculations.test.ts`, `tests/workouts/validation.test.ts`. `vitest` devDep + `test`/`test:watch` scripts + `vitest.config.ts` (tests live in `tests/`, outside the app typecheck).

### Phase 3
- `src/lib/workouts/useTrackingMode.ts` (localStorage `macroforge-tracking-mode`), `hooks.ts` (react-query wrappers), `api.ts` `fetchWorkoutStats` range roll-up.
- `src/components/workout/`: `TrackingModeToggle`, `TrainingPhaseSelect`, `WorkoutSetEditor` (reps, load mode, preset ladder + custom weight input that is always shown when "Custom", bodyweight = optional added load, RIR/RPE/rest, completed switch), `WorkoutExerciseForm` (catalog datalist rendered once, muscle group, equipment, variant, add/remove sets), `WorkoutLogger` (date/phase/intensity/duration/notes, collapsible wearable block with the required "not configured" copy, live external-load volume + single-source calorie preview, `validateWorkoutDraft` error list, double-submit guard via ref + `isPending`), `WorkoutSummaryCards`, `WorkoutHistory` (expand to detail + delete with confirm), `WorkoutDashboard` (guest gate, empty/loading/error states).
- `src/routes/_authenticated/dashboard.tsx` — `TrackingModeToggle` above the shared range controls; `{trackingMode === "food" ? <existing food dashboard, unchanged/> : <WorkoutDashboard fromDate toDate bodyWeightKg/>}`; Export CSV hidden in workout mode; body weight = latest daily-metric weight ?? profile start weight.

### Phase 4
- `src/lib/workouts/notifications.ts` — pure `buildWorkoutNotifications` + `filterNotificationDrafts` (max 1 per category/day, max 5 non-system/week, quiet-hours suppression for non-critical, per-category enable flags, one draft per category per run, stable `progression:<slug>` dedupe keys) + `isoWeekKey`/`exerciseSlug`/`isWithinQuietHours`; impure `runWorkoutNotifications` (throttled ~8h/device, DB-deduped, runs the top ~4 recent exercises through `analyzeExerciseProgression`; nothing fires from a single workout — `insufficient_data` is skipped).
- `src/lib/workouts/api.ts` — `fetchRecentExerciseNames`, `fetchTrainingHistorySummary` (sessions, consistent ISO-weeks, progression-evidence proxy), `fetchNotificationPreferences`/`saveNotificationPreferences`, `createNotificationIfAbsent`.
- `src/components/workout/`: `ExperienceLevelCard` (`calculateExperienceLevel` + the exact disclaimer, "Not enough data yet"), `ProgressionSuggestion` (pick a recent exercise → analysis badge + explanation + suggested load + insufficient-data message), `NotificationBell` (Popover + unread badge, added to `AppShell` for signed-in users) + `NotificationPanel` (list, mark read / mark all / dismiss, category badges, loading/error/empty, keyboard via Popover), `NotificationPreferences` (rep-range/sets targets + 3 toggles + quiet hours), `WearableConnectionCard` (disabled, honest), `WhatsAppSettings` (phone, opt-in + consent/revoke bookkeeping, 4 category toggles, quiet hours, "delivery disabled" + the required availability sentence).
- `src/lib/wearables/{types,provider,miFitnessProvider}.ts` — `WearableProvider` interface (connect/disconnect/getConnectionStatus/syncWorkouts/syncSleep/syncHeartRate); `DisabledWearableProvider` throws `WearableNotConfiguredError` on every sync — no fabricated data; `miFitnessProvider` is a disabled stub and Mi Band / Mi Fitness is never shown as working.
- `src/lib/whatsapp/{types,provider,api}.ts` — `WhatsAppProvider` + `WhatsAppMessage` exactly per spec; `DevelopmentWhatsAppProvider` (send throws `WhatsAppDisabledError` + logs disabled; `verifyWebhook` returns false; `processWebhook` no-op); `WHATSAPP_DELIVERY_ENABLED = false`; prefs read/write on `whatsapp_preferences`. No tokens in client code; opt-in only.
- `tests/workouts/notifications.test.ts`.

## Checks run
- **Type-check + production build:** Lovable's remote pipeline runs `vite build` (which type-checks against the strict tsconfig) on every push. **Green for all five phase commits** (`3cfc1ed`, `d39c14e`, `05893db`, `f909949`).
- **Production build + deploy:** `f909949` deployed to https://food-goal.lovable.app.
- **Lint (`eslint .`):** NOT run — no Node toolchain in this environment; Lovable's pipeline does not run lint. Code follows the repo's existing lint-clean patterns; `@typescript-eslint/no-unused-vars` is off in the repo config and `react-refresh/only-export-components` is `warn` (non-fatal) — one such warning is expected on `WorkoutExerciseForm.tsx` (exports a helper alongside the component).
- **Unit tests (`vitest`):** written (30+ cases across calculations / validation / notifications, covering all 17 required scenarios except that #14 is exercised via `buildWorkoutNotifications`/`filterNotificationDrafts`). **NOT executed here** — no Node runtime. Run `npm install && npm test` (or `bun install && bun run test`) to execute them.

## Errors fixed during the build
- `analyzeExerciseProgression`: added an explicit `sorted[0]`/`sorted.at(-1)` guard for `noUncheckedIndexedAccess`.
- Several `useEffect` closures captured a react-query `.data` after an `if` narrow — hoisted to a local `const data = …` so the narrow survives into the closure (WorkoutLogger, NotificationPreferences, WhatsAppSettings).
- `ProgressionSuggestion`: `Record` lookup was `| undefined` under the strict flag — added a fallback.
- Duplicate `<datalist id>` across repeated exercise forms — render the catalog datalist once in `WorkoutLogger`.
- Test expectation for the progression suggestion used a weight off the ladder — switched to a ladder weight (20 → 22.5 kg).

## Known limitations / assumptions
- **Workout tracking requires a signed-in account** (the RPC needs `auth.uid()`); guests see a "create an account" card in workout mode. Food tracking + the 3-day guest mode are untouched.
- `updateWorkoutSession` edits session-level fields only (date/duration/intensity/phase/notes/HR) — it does not rewrite exercises/sets after a workout is saved.
- Progression-evidence for the experience estimate is a **proxy** (last-third vs first-third mean session volume), documented in code.
- Notification generation runs client-side (throttled, DB-deduped). There is no server cron; it fires on dashboard mount and after a save.
- WhatsApp: architecture + a disabled dev provider only. **No real sending.** Wearable: adapter interface + disabled providers only. **No real sync, no fabricated data, Mi Band not presented as working.**
- `vitest ^2.1.9` pinned against the repo's unusual `vite 8.1.5`; Lovable's build does not install/run it and it did not affect any build.

## REQUIRED FROM USER
1. **Run the migration** — open Lovable → **Cloud → SQL editor**, paste the whole of `supabase/migrations/20260908120000_workout_tracking.sql`, run it. Until this is done, every workout API call fails and the workout dashboard shows its "migration may not be applied yet" message. (Lovable's agent is out of credits and cannot apply it; there is no direct Supabase dashboard access.)
2. **(Optional) Run the unit tests** — `npm install` then `npm test` (adds/uses `vitest`). Everything else was verified via Lovable's `vite build` type-check.
3. **(Optional, for SMS/WhatsApp later)** — WhatsApp delivery needs an official WhatsApp Business Cloud API connection + approved templates + server-side credentials before it can be switched on. Phone/SMS OTP (separate, pre-existing) needs an SMS provider in Supabase Auth.
4. **No wearable action possible** — there is no supported official Mi Fitness / Mi Band API to integrate; the provider stays disabled.

## Production migration approval
- The migration file is **created and committed** but **NOT applied to the database** — it is additive (new enums/tables/policies/function only; no changes to existing food-tracking tables) and safe to run, but applying it is left to the user per the rules above.
