# Phase 2 pre-work — Phase 1 hardening carry-overs

**Slug:** phase-2-hardening-carryover
**Status:** done
**Ticket:** N/A
**Related plan:** [phase-2-hardening-carryover-plan-next-phase-generic-penguin.md](../_plans/phase-2-hardening-carryover-plan-next-phase-generic-penguin.md)
**Created:** 2026-08-13
**Updated:** 2026-08-13

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | `phase-2/hardening-carryover` | N/A |  |

## Background & goals

Phase 1 closed with four known-but-deferred items, recorded in
`docs/component-library.md` ("Open items for Phase 2") and the Phase 1
item's Follow-ups line. The user chose to close all four before starting
Phase 2 (DSL + compiler) rather than carry them into it — each is a
correctness or enforcement gap in the foundation Phase 2 builds on.

1. **CJK label overflow.** Diagram node footprints came from a fixed
   `Size` token table (`md` = 268×228), so a label wider than that
   rendered through the card's border. Trivially reached in Chinese, where
   every glyph is full-width — and the eval set's remaining two videos
   (MQ backpressure, DB index) are Chinese-heavy. **Decision: measure the
   text and add CSS guardrails**, rather than guardrails alone.
2. **CameraTarget measurement staleness.** A one-shot ref read of
   `offsetWidth` on mount — the same shape of bug that made Diagram's
   original `fit` scaling non-deterministic in the real renderStill
   pipeline. Unnoticed because nothing in the repo used the component.
   **Decision: keep and fix**, rather than remove.
3. **Transition overlap math.** A transition overlaps its two neighbours,
   so a composition's real duration is Σ durations − Σ overlaps.
   `buildTimeline()` didn't model this, so enabling any non-cut boundary
   would have silently produced trailing blank frames.
4. **ESLint barrel enforcement.** Skipped in Phase 1 as "fragile to encode
   across varying relative-import depths". Re-examined: ESLint matches
   `no-restricted-imports` patterns with gitignore syntax, not minimatch,
   so one depth-agnostic `**/components/**` pattern suffices.

Delivered as one PR into `main` on `phase-2/hardening-carryover`, sliced
into five commits so each concern is reviewable on its own.

## Task list

- [x] Commit 1 — ESLint barrel rule + Root.tsx normalization
- [x] Commit 2 — timeline.ts transition math + shared SceneSeries
- [x] Commit 3 — fontsReady() + measured node sizes + CSS guardrails
- [x] Commit 4 — CameraTarget robust measurement
- [x] Commit 5 — docs + progress + PR

## Work log

### 2026-08-13

-
- All four carry-overs implemented across 5 commits on phase-2/hardening-carryover. Item 4 (ESLint) went first so every later commit was written under the rule; verified by deliberate violation at both import depths rather than by inspection. Item 3 introduced compositions/timeline.ts (pure, parameterized, unit-tested) plus a shared SceneSeries component, so the transition wiring exists once and ComponentGallery's fade exercises the exact path the eval-set videos would use — JWT stays all-cut and TOTAL_FRAMES is pinned at 1200 by a new storyboard.test.ts. Item 1 added fontsReady() as the shared correctness gate (loadFonts' delayRender blocks the screenshot but not React's effects, so measuring on mount captures fallback-font metrics), then split the sizing into a node-testable pure rule and a browser-only measurer; computeLayout takes an optional nodeSizes record so GraphSpec still carries no geometry. Item 2 reused the same fontsReady gate plus a labelled delayRender handshake and per-commit re-measure. Verified by rendering at every step, which caught two things static checks could not: the long-CJK cap/wrap behaviour, and CameraTarget measuring full-width as a block element (fixed with inline-block shrink-wrap). pnpm verify green: 56 tests, both compositions smoke-rendered, gallery now 615 frames per the overlap math.
- Opened PR #7 (https://github.com/FWcloud916/motife/pull/7) into main.
- Closed item as `done`.

## Outcome

All four Phase 1 carry-overs closed before Phase 2 began. Diagram nodes now size from measured text (fontsReady-gated, delayRender-guarded) with CSS wrap guardrails behind a 560px cap; CameraTarget uses the same font gate plus a labelled delayRender handshake and per-commit re-measure; transition overlap is modelled in a new pure compositions/timeline.ts feeding a shared SceneSeries, with ComponentGallery carrying the one fade that keeps the path smoke-covered; and the components-barrel rule is now ESLint-enforced rather than convention. Phase 1's premise that the lint rule was 'fragile across import depths' turned out to be wrong — ESLint matches these patterns with gitignore syntax, so one depth-agnostic pattern suffices. Two defects were caught by rendering rather than by static checks: the CJK cap/wrap behaviour, and CameraTarget measuring full-width as a block element (fixed with inline-block shrink-wrap). Tests grew 30 to 56; JWT baseline unchanged at 1200 frames and pinned by a new test.

**Final status:** done
**PR / Commit:** PR #7 (merged, commit d46a657)
**Follow-ups:** Phase 2 (DSL + compiler) — docs/component-library.md now lists no open items. The gallery permanently exercises the CJK-measured node, the fade boundary, and CameraTarget, so pnpm smoke regresses all three going forward.
