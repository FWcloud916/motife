# Phase 1 — 解說元件庫 (Explainer Component Library)

**Slug:** phase-1-component-library
**Status:** in-progress
**Ticket:** N/A
**Related plan:** [phase-1-component-library-plan-next-phase-generic-penguin.md](../_plans/phase-1-component-library-plan-next-phase-generic-penguin.md)
**Created:** 2026-08-13
**Updated:** 2026-08-13

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | `phase-1/diagram-flow-code` | N/A |  |

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
- [ ] PR 4 — swap-and-cleanup (swap into JwtAuthFlow id, delete old primitives, docs)

## Work log

### 2026-08-13

-
- Starting PR 1 (tokens-and-foundation) on branch phase-1/tokens-and-foundation.
- PR 1 (tokens-and-foundation) complete on branch phase-1/tokens-and-foundation: src/components/tokens (color/tone recipes, fontFamily, easing, spacing/duration/radius carried over from theme.ts), tokens/fonts.ts (Inter/NotoSansTC/JetBrainsMono via @remotion/google-fonts, CJK weights trimmed 4->2 to cut ~400 render-time network requests to ~200), motion/{timing,progress}.ts (pure, vitest-covered: resolveWindow/resolveSteps/stepStateAtFrame), icons/{registry,Icon}.tsx (11 IconNames, +cross/database/queue/lock/document), Scene/{Scene,SceneContext,Background}.tsx, Callout/Callout.tsx (pill/card/banner), StepReveal/StepReveal.tsx (+ exported useSteps hook for sibling-panel sync). theme.ts is now a deprecated re-export shim over src/components/tokens so Phase 0 scenes compile unchanged. Root.tsx calls loadFonts() once. vitest added, pnpm verify green (14 tests, typecheck+lint+smoke all pass). Baseline stills eyeballed against docs/assets/*.png for font-change parity -- visually identical.
- Opened PR #2 (https://github.com/FWcloud916/motife/pull/2) for phase-1/tokens-and-foundation. Awaiting review/merge before starting PR 2 (diagram-flow-code).
- PR 2 (diagram-flow-code) complete on branch phase-1/diagram-flow-code (stacked on PR 1): src/components/layout (GraphSpec/LayoutResult types, computeLayout via @dagrejs/dagre, rounded-corner SVG edgePath — all pure, vitest-covered incl. determinism), Diagram (+ ComponentGallery-verified rendering), FlowPulse (@remotion/paths getPointAtLength/evolvePath for the traveling dot + trailing stroke), CodeBlock (own tokenized micro-model, diff/highlight support), Terminal (deterministic typed-command simulation), Camera (+CameraTarget, zoom/pan/focus by Diagram node or registered target). Found and fixed a real determinism bug during visual verification: Diagram's original fit-scaling used a one-shot ref-measured clientWidth that could observe a stale pre-layout size in Remotion's actual renderStill pipeline (not just Studio) -- replaced with SVG viewBox+preserveAspectRatio (zero JS measurement); Camera's viewport size similarly switched from ref-measurement to useVideoConfig() (synchronous, exact). Also fixed a coordinate-space bug where Diagram nested in Camera must render at native scale starting at (0,0) with no offsetting wrapper, documented on both components. Verified visually via Remotion Studio (localhost:3000) and smoke.mjs renderStill output for all 5 components before considering the PR done. Extended scripts/smoke.mjs to smoke every registered composition via getCompositions() instead of one hardcoded id. pnpm verify green (30 tests, typecheck+lint+smoke both compositions).
- Opened PR #3 (https://github.com/FWcloud916/motife/pull/3) for phase-1/diagram-flow-code, stacked on/targeting phase-1/tokens-and-foundation (#2). Continuing to PR 3 (jwt-rebuild).
- PR 3 (jwt-rebuild) complete on branch phase-1/jwt-rebuild (stacked on PR 2): rebuilt all 4 JwtAuthFlow scenes (Intro, Breakdown, Walkthrough, Summary) under scenes-v2/ using only src/components, registered as JwtAuthFlowV2 alongside the untouched Phase 0 baseline, wired through @remotion/transitions TransitionSeries with no Transition between scenes (hard-cut, timing-equivalent to the baseline's plain Sequence zip). Walkthrough (the hardest target) replaces the original's hardcoded per-step frame numbers with resolveSteps()/stepStateAtFrame() driven off one shared STEPS_WINDOW, so the checklist and the synced detail panel both re-time automatically if duration changes. Found and fixed one real component bug during the rebuild: FlowPulse's edge label could land directly on top of a node icon on short edges (dagre routes to the node's vertical center) -- fixed with an SVG paintOrder:'stroke' halo so the label stays legible regardless of what's underneath, no text measurement needed. Saved v2 stills (anatomy/validation/summary) to docs/assets/ next to the Phase 0 originals for direct comparison -- visually confirmed quality matches or exceeds the baseline at all three reference frames. pnpm verify green (30 tests, typecheck+lint+smoke across all 3 compositions).

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
