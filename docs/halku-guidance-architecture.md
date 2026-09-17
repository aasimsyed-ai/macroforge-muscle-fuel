# Halku guidance architecture (future work — nothing here is wired up yet)

This documents the clean way to build the "Halku physically guides you
through the app" interaction requested for a later task, without forcing a
half-built version into this one. Nothing described below currently
navigates anything, highlights anything, or changes any UI on its own — the
only things that exist today are the two small type/prop seams noted at the
end, which future work can build on without a rewrite.

## Why not build it now

"Guide me to X" needs three things working together: a place to say *what*
element is the target, a way to visually point at it wherever it currently
renders, and a way to move the user's attention (and possibly the route)
there. Rushing a version of this without real design/interaction-testing
tends to produce exactly the "distracting particle effects" this project
explicitly wants to avoid. Better to land the seams now and build the real
interaction as its own reviewed piece of work.

## Proposed pieces, when this is built

**1. Anchor IDs.** Any control Halku might one day point at gets a stable,
human-readable `data-halku-anchor="workout.add-set"`-style attribute (dot-
namespaced by section, e.g. `workout.*`, `food.*`, `progress.*`). Adding
these is cheap and non-invasive — a plain HTML attribute, invisible to
everything else — and could be done incrementally, section by section,
without needing the rest of this system to exist yet.

**2. A spotlight/highlight component.** A single, small, portal-rendered
component (e.g. `HalkuSpotlight`) that takes an anchor id, looks it up via
`document.querySelector('[data-halku-anchor="…"]')`, and draws a
non-blocking ring/glow around its bounding box (recomputed on scroll/resize).
It renders nothing when the anchor isn't found (e.g. wrong route) rather
than erroring — the guidance UI must never assume the target exists.

**3. A `HalkuGuidanceState`.** Already added in this task —
`src/components/halku/HalkuAvatar.tsx` exports the type (`idle` |
`thinking` | `explaining` | `encouraging` | `celebrating` | `concerned` |
`guiding`) and `HalkuAvatar` doesn't yet do anything different per state
(only the neutral asset exists), but the vocabulary now exists for a future
`state` prop to actually swap art/expression once that art is approved.

**4. A "guide me" action state + navigation handoff.** When Halku's answer
includes something like `{ guide: { anchor: "workout.add-set", route:
"/log-workout" } }` (an addition to `HalkuAnswer`, not built here), the chat
panel would: navigate if not already on that route (via the existing
TanStack Router, nothing new), wait for the anchor to mount, then render
`HalkuSpotlight` pointed at it, and switch `HalkuAvatar`'s state to
`guiding`. The chat dialog would need to close or minimize so the spotlight
is visible — that interaction (does closing the dialog feel abrupt? does
Halku's character travel across the screen, or just the spotlight?) is
exactly the part worth designing deliberately rather than guessing at here.

## What's actually different in the repo after this task

- `HalkuAvatar.tsx` exports `HalkuGuidanceState` (a plain type, no runtime
  behavior) and `HalkuAvatar` accepts (but does not yet use) an `interactive`
  prop for its own hover/idle motion — unrelated to guidance, but the same
  file, so noted here for anyone reading it top to bottom.
- Nothing else. No anchors, no spotlight component, no navigation handoff
  exist yet — this file is the plan, not the implementation.
