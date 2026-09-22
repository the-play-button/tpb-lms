# 02 — Converge viewMode to single authority (refacto-lifecycle-contract-fracture) — DONE

## Signal (why this cycle applied)
My BUG-1 fix (plan 01) introduced a `viewMode` concept whose lifecycle (overview↔step) was written
by **N scattered fragments** — `showCourseOverview` ('overview'), `loader.loadCourse` ('step'),
`navigation.navigateToStep` ('step') + a default. Classic lifecycle-contract fracture: no single
authority owns the "which surface is showing" transition. The audit even found a **forgotten path**:
`quiz/handler.js` calls `renderCurrentStep()` without setting viewMode → a step re-render there would
have kept a stale 'overview' (the exact bug re-appearing via another fragment).

## Audit → the single authority
The truth "overview vs step" is a RENDERED-SURFACE fact. There are exactly two mutually-exclusive
surfaces, each with ONE render authority (verified: all call sites):
- `renderCurrentStep` (course/renderer.js) — the ONLY step render (loader, all navigation, quiz
  handler, event listeners route through it).
- `renderCourseOverview` (course/overview.js) — the ONLY overview render.

## Converge-refactor-forward (ruthless: ONE AUTHORITY = ONE PATH)
- `renderCurrentStep` now owns `viewMode='step'` ; `renderCourseOverview` owns `viewMode='overview'`.
- **Deleted** the 3 scattered `setState('viewMode',…)` writes (showCourseOverview / loader / navigateToStep).
- Sidebar subscribes to `viewMode` (added to `SUBSCRIBED_KEYS`) so the read side reflects the surface.
- Result: any path (present or future) that shows a step/overview goes through its render authority →
  viewMode is correct by construction, no forgotten path.

## Lock (deterministic single-owner gate)
`frontend-on-cf-worker/app/course/viewMode.single-authority.test.js` — scans `app/` and asserts
`setState('viewMode', …)` appears in EXACTLY `course/renderer.js` + `course/overview.js`, and that the
sidebar subscribes to `viewMode`. A future scattered write fails the test. (2/2 pass.)

## Fichiers modifiés
- `app/course/renderer.js` (import setState + owns viewMode='step'), `app/course/overview.js`
  (renderCourseOverview owns 'overview'; scattered write removed), `app/course/loader.js` +
  `app/course/navigation.js` (scattered writes removed), `app/ui/sidebar.js` (viewMode subscribed),
  `app/course/viewMode.single-authority.test.js` (created — the lock).

## Résultat de validation (LIVE — tpb-browser, lms.theplaybutton.ai)
- [x] Topology: viewMode writers = exactly {renderer.js, overview.js} ; readers only elsewhere.
- [x] HANDOFF step→overview (click course header): viewMode flips to 'overview' → outline 8/8 +
      resume ▶ lesson clickable ; sidebar 8/8 clickable.
- [x] HANDOFF overview→step (click the resume lesson — the original bug): opens the lesson, leaves the
      overview, sidebar current lesson non-clickable again (viewMode back to 'step').
- [x] Sentinel 2/2 ; sidebar tree 7/7 ; reload 0 console errors.
