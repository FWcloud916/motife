# Phase 1 — 解說元件庫 (Explainer Component Library)

**Slug:** phase-1-component-library
**Status:** done
**Ticket:** N/A
**Related plan:** [phase-1-component-library-plan-next-phase-generic-penguin.md](../_plans/phase-1-component-library-plan-next-phase-generic-penguin.md)
**Created:** 2026-08-13
**Updated:** 2026-08-13

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | `phase-1/swap-and-cleanup` | N/A |  |

## Background & goals

Phase 0 (anchoring) shipped a hand-built 40s `JwtAuthFlow` baseline video
using ad-hoc, copy-pasted visual primitives
(`src/remotion/compositions/jwt-auth/visuals.tsx`) and a primitive inventory
(`docs/primitive-inventory.md`) cataloging what got reused. Per
`motife-plan.md` §3 Phase 1, this phase refactors those primitives into a
parameterized, design-token-driven component library under `src/components/`:
`Scene`, `Diagram`, `FlowPulse`, `CodeBlock`, `Terminal`, `Camera`,
`StepReveal`, `Callout`, plus supporting `tokens/`, `motion/`, `icons/`, and
`layout/` modules. Components must accept only semantic, JSON-serializable
props (no `style`/`className`/`boxShadow`) so Phase 2's DSL compiler can
emit them verbatim, and all timing must be expressed as fractions of the
enclosing Scene's duration so Phase 3's TTS-driven durations re-time
everything automatically.

Acceptance (motife-plan.md milestone M1): rebuild the JWT video using only
the component library with hand-written props, at quality no worse than the
manual Phase 0 version.

Delivered as 4 sequential PRs into `main`, each passing `pnpm verify` with
the Phase 0 baseline still rendering throughout:
1. `phase-1/tokens-and-foundation` — tokens, fonts, motion helpers, vitest,
   Scene/Callout/StepReveal/Icon registry.
2. `phase-1/diagram-flow-code` — Diagram+dagre layout, FlowPulse, CodeBlock,
   Terminal, Camera, ComponentGallery demo composition.
3. `phase-1/jwt-rebuild` — JwtAuthFlowV2 acceptance rebuild, parallel to the
   untouched baseline.
4. `phase-1/swap-and-cleanup` — swap v2 into the `JwtAuthFlow` id, delete
   Phase 0 primitives, docs updates.

Full design detail in the linked plan snapshot.

## Task list

- [x] PR 1 — tokens-and-foundation (tokens/fonts/motion/vitest + Scene, Callout, StepReveal, Icon registry)
- [x] PR 2 — diagram-flow-code (Diagram+dagre, FlowPulse, CodeBlock, Terminal, Camera, ComponentGallery)
- [x] PR 3 — jwt-rebuild (JwtAuthFlowV2 acceptance rebuild + transitions)
- [x] PR 4 — swap-and-cleanup (swap into JwtAuthFlow id, delete old primitives, docs)

## Work log

### 2026-08-13

-
- Starting PR 1 (tokens-and-foundation) on branch phase-1/tokens-and-foundation.
- PR 1 (tokens-and-foundation) complete on branch phase-1/tokens-and-foundation: src/components/tokens (color/tone recipes, fontFamily, easing, spacing/duration/radius carried over from theme.ts), tokens/fonts.ts (Inter/NotoSansTC/JetBrainsMono via @remotion/google-fonts, CJK weights trimmed 4->2 to cut ~400 render-time network requests to ~200), motion/{timing,progress}.ts (pure, vitest-covered: resolveWindow/resolveSteps/stepStateAtFrame), icons/{registry,Icon}.tsx (11 IconNames, +cross/database/queue/lock/document), Scene/{Scene,SceneContext,Background}.tsx, Callout/Callout.tsx (pill/card/banner), StepReveal/StepReveal.tsx (+ exported useSteps hook for sibling-panel sync). theme.ts is now a deprecated re-export shim over src/components/tokens so Phase 0 scenes compile unchanged. Root.tsx calls loadFonts() once. vitest added, pnpm verify green (14 tests, typecheck+lint+smoke all pass). Baseline stills eyeballed against docs/assets/*.png for font-change parity -- visually identical.
- Opened PR #2 (https://github.com/FWcloud916/motife/pull/2) for phase-1/tokens-and-foundation. Awaiting review/merge before starting PR 2 (diagram-flow-code).
- PR 2 (diagram-flow-code) complete on branch phase-1/diagram-flow-code (stacked on PR 1): src/components/layout (GraphSpec/LayoutResult types, computeLayout via @dagrejs/dagre, rounded-corner SVG edgePath — all pure, vitest-covered incl. determinism), Diagram (+ ComponentGallery-verified rendering), FlowPulse (@remotion/paths getPointAtLength/evolvePath for the traveling dot + trailing stroke), CodeBlock (own tokenized micro-model, diff/highlight support), Terminal (deterministic typed-command simulation), Camera (+CameraTarget, zoom/pan/focus by Diagram node or registered target). Found and fixed a real determinism bug during visual verification: Diagram's original fit-scaling used a one-shot ref-measured clientWidth that could observe a stale pre-layout size in Remotion's actual renderStill pipeline (not just Studio) -- replaced with SVG viewBox+preserveAspectRatio (zero JS measurement); Camera's viewport size similarly switched from ref-measurement to useVideoConfig() (synchronous, exact). Also fixed a coordinate-space bug where Diagram nested in Camera must render at native scale starting at (0,0) with no offsetting wrapper, documented on both components. Verified visually via Remotion Studio (localhost:3000) and smoke.mjs renderStill output for all 5 components before considering the PR done. Extended scripts/smoke.mjs to smoke every registered composition via getCompositions() instead of one hardcoded id. pnpm verify green (30 tests, typecheck+lint+smoke both compositions).
- Opened PR #3 (https://github.com/FWcloud916/motife/pull/3) for phase-1/diagram-flow-code, stacked on/targeting phase-1/tokens-and-foundation (#2). Continuing to PR 3 (jwt-rebuild).
- PR 3 (jwt-rebuild) complete on branch phase-1/jwt-rebuild (stacked on PR 2): rebuilt all 4 JwtAuthFlow scenes (Intro, Breakdown, Walkthrough, Summary) under scenes-v2/ using only src/components, registered as JwtAuthFlowV2 alongside the untouched Phase 0 baseline, wired through @remotion/transitions TransitionSeries with no Transition between scenes (hard-cut, timing-equivalent to the baseline's plain Sequence zip). Walkthrough (the hardest target) replaces the original's hardcoded per-step frame numbers with resolveSteps()/stepStateAtFrame() driven off one shared STEPS_WINDOW, so the checklist and the synced detail panel both re-time automatically if duration changes. Found and fixed one real component bug during the rebuild: FlowPulse's edge label could land directly on top of a node icon on short edges (dagre routes to the node's vertical center) -- fixed with an SVG paintOrder:'stroke' halo so the label stays legible regardless of what's underneath, no text measurement needed. Saved v2 stills (anatomy/validation/summary) to docs/assets/ next to the Phase 0 originals for direct comparison -- visually confirmed quality matches or exceeds the baseline at all three reference frames. pnpm verify green (30 tests, typecheck+lint+smoke across all 3 compositions).
- Opened PR #4 (https://github.com/FWcloud916/motife/pull/4) for phase-1/jwt-rebuild, stacked on/targeting phase-1/diagram-flow-code (#3). Continuing to PR 4 (swap-and-cleanup).
- PR 4 (swap-and-cleanup) complete on branch phase-1/swap-and-cleanup (stacked on PR 3): swapped scenes-v2/ into place as scenes/, sceneRegistryV2.tsx/JwtAuthFlowV2.tsx renamed to replace the originals (composition id stays 'JwtAuthFlow' -- the stable public handle pnpm render/still/smoke all address). Deleted the Phase 0 primitives: visuals.tsx, src/remotion/theme.ts (the deprecated shim), and the old scenes/*.tsx. Root.tsx now registers only 2 compositions (JwtAuthFlow, ComponentGallery) -- no more V2 duplicate. Updated docs/primitive-inventory.md (Phase 1 outcome section, v2 stills linked) and docs/project-overview.md (directory tree, Phase 0/1 narrative) with Last-updated bumps; added docs/component-library.md as the Phase 1 public API reference / Phase 2 DSL schema draft. Skipped the optional ESLint import-restriction hardening (fragile to encode correctly across varying relative-import depths; noted as a follow-up rather than risking a broken lint config). pnpm verify green end-to-end; pnpm still confirmed the swapped composition renders correctly through the real Remotion CLI, not just the smoke script.
- Opened PR #5 (https://github.com/FWcloud916/motife/pull/5) for phase-1/swap-and-cleanup, stacked on/targeting phase-1/jwt-rebuild (#4). All 4 Phase 1 PRs are now open, stacked in order (#2 tokens-and-foundation -> #3 diagram-flow-code -> #4 jwt-rebuild -> #5 swap-and-cleanup), each individually pnpm-verify-green. Merge order: #2, #3, #4, #5 into main. Transitioning item to review pending merge.
- PR #2 (tokens-and-foundation) and PR #3 (diagram-flow-code) merged into main as merge commits 4bf04ee and cc19396. PR #4 retargeted from phase-1/diagram-flow-code to main and is still MERGEABLE/CLEAN; PR #5 continues to target phase-1/jwt-rebuild. Verified the merged main directly (detached checkout of origin/main + frozen-lockfile install): pnpm verify fully green — typecheck, lint, 30 tests, and smoke render of both JwtAuthFlow and ComponentGallery. Remaining to merge: #4 then #5.
- Closed item as `done`.

## Outcome

Phase 1 complete (motife-plan.md milestone M1). All 8 planned components built under src/components/ with a design-token system; JwtAuthFlow rebuilt entirely from the library and swapped in, replacing the Phase 0 hand-built scenes and visuals.tsx. Three real rendering bugs found and fixed via visual verification: Diagram's ref-measured fit scaling was non-deterministic in the actual renderStill pipeline (replaced with SVG viewBox), Camera's viewport measurement had the same fragility (replaced with useVideoConfig), and FlowPulse edge labels overlapped node icons on short edges (SVG paint-order halo).

**Final status:** done
**PR / Commit:** PRs #2, #3, #4, #5 (all merged into main; final merge commit 2ca56e7)
**Follow-ups:** Phase 2 (DSL + compiler). Carried-over open items were recorded in docs/component-library.md: CJK label overflow in fixed-size Diagram nodes, CameraTarget's ref-measurement staleness risk, non-cut scene transitions not yet threaded through buildTimeline(), and the skipped ESLint import-restriction hardening. **All four were closed before Phase 2 began — see [progress/2026-08-13-phase-2-hardening-carryover/](../2026-08-13-phase-2-hardening-carryover/PROGRESS.md).**
