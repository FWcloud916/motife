# Phase 2 — DSL + Compiler

**Slug:** phase-2-dsl-compiler
**Status:** in-progress
**Ticket:** N/A
**Related plan:** [phase-2-dsl-compiler-phase-2-playful-platypus.md](../_plans/phase-2-dsl-compiler-phase-2-playful-platypus.md)
**Created:** 2026-08-13
**Updated:** 2026-08-13

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | `phase-2/dsl-compiler` | TBD |  |

## Background & goals

Phase 2 of motife-plan.md §3: build the DSL + compiler layer between the
Phase 1 component library and the future Phase 3 agent pipeline. Deliverables:
a JSON Schema for the narrative DSL (fixed beat skeleton
intro→breakdown→walkthrough→summary), a runtime-interpreting compiler with
human-readable validation errors, and three hand-written DSL documents
(JWT auth, MQ backpressure, DB index internals) each rendering end to end.
Exit criterion: 不碰 TypeScript、只改 JSON 就能產出一支完整影片.

Every existing scene composes the component library with raw JSX + inline
CSS, which the DSL forbids — so this phase first extends the library with
semantic layout/text primitives (Stack, Text, Meter, StepSwitch,
stepWindows()), proven by rewriting the four JWT TSX scenes with them, before
any schema work starts. Full design in the linked plan.

## Task list

- [x] Stage 1 — Semantic primitives (Stack, Text, Meter, StepSwitch, stepWindows(), CodeBlock.chrome, Diagram windowed activeNodes, ICON_NAMES); rewrite JWT TSX scenes to prove them
- [x] Stage 2 — DSL schema (zod) + validator + semantic cross-reference checks + error formatting, tests only
- [x] Stage 3 — Runtime interpreter (DslVideo/DslSceneView/nodes) + composition registration (DslPreview) + render:dsl script
- [x] Stage 4 — Port JWT to DSL (JwtAuthFlowDsl), A/B against TSX baseline stills
- [x] Stage 5 — Author MqBackpressure DSL video
- [ ] Stage 6 — Author DbIndexInternals DSL video
- [ ] Stage 7 — Cutover (delete JWT TSX, rename doc id) + docs updates (dsl-schema.md, component-library.md, project-overview.md, primitive-inventory.md, README.md, CLAUDE.md, motife-plan.md)

## Work log

### 2026-08-13

-
- Plan approved; branch phase-2/dsl-compiler created; starting Stage 1 (semantic primitives).
- Stage 1 done: added Stack/Text/Meter/StepSwitch/stepWindows() primitives, CodeBlock.chrome, Diagram windowed activeNodes + width/grow, Callout/CodeBlock/Terminal width/grow, ICON_NAMES export. Rewrote all 4 JWT TSX scenes to use only these primitives (zero raw div style, zero useCurrentFrame in scene code). Found and fixed a real rendering bug during A/B: Summary's cards row pinned flush to the hero-scale header via justify="between" visually crowded/overlapped the title's line box, misread initially as a duplicate-text artifact — fixed by centering the [cards, footer] group instead, and decoupled Callout's grow from forcing height:100% (main-axis flex-grow only). pnpm verify green (61 tests), 1200-frame pin holds, smoke renders both compositions clean, A/B verified against docs/assets/*-v2.png at 3 canonical frames (anatomy/validation/summary) with only expected minor deltas.
- Stage 2 done: zod@4.4.3 DSL schema (src/dsl/schema.ts + types.ts) — 14-node recursive discriminated union, WindowRef 3-shape union, step tracks. Hit two real zod v4 pitfalls: TS can't infer through a recursive discriminated union referenced via getters (hand-declared DslNode + z.ZodType annotation), and .strict() reads .shape eagerly so v4's getter pattern throws a ReferenceError at runtime on this shape — switched to z.lazy() which is genuinely deferred. Built the compiler layer: windows.ts (pure resolveWindowRef, handles nested track chains), errors.ts (DslIssue contract + formatIssues), zodIssues.ts (maps zod errors to DslIssues, with a special case for unmatched-discriminator listing legal node types), validate.ts (19 semantic cross-reference checks: scene/beat/track/window/graph/camera/switch-case/transition/narration-pacing), parse.ts (the one public parseDocument/parseDocumentOrThrow constructor), timeline.ts (wraps existing buildTimeline). 113 tests total (up from 61): full table-driven coverage of every DslIssueCode via mutation of one realistic fixture, code-exhaustiveness compile check, formatIssues snapshot, z.toJSONSchema smoke test. tsconfig lib bumped es2015->ES2020 (Array.prototype.includes needed it — anticipated as risk R3). eslint barrel-import rule extended to src/compiler/**. pnpm verify green throughout; nothing wired to a render yet, so JwtAuthFlow/ComponentGallery output is untouched.
- Stage 3 done: DSL interpreter -- src/compiler/render/nodes.tsx (Record<DslNodeType, FC> registry, one renderer per node translating WindowRef fields to resolved Window via resolveWindowRef), DslSceneView.tsx (Scene wrapper + track map + root node, with caption null/omit/explicit fallback), DslVideo.tsx (reuses the existing dslTimeline()/SceneSeries unchanged -- zero new transition wiring). Registered a DslPreview composition in Root.tsx with a parsed-at-module-scope BLANK_DOC default and a calculateMetadata deriving duration/fps/size from whatever doc it's handed (had to fix a real misuse of Composition's Schema/Props generics, and split calculateMetadata into a separately-typed const per Remotion's own documented pattern -- inline arrow functions don't propagate the Props inference). Added scripts/render-dsl.mjs + pnpm render:dsl <doc.json> <out.mp4> -- the zero-TypeScript render path; deliberately does NOT duplicate validation in plain Node (can't import .ts directly there, and parameter-property classes need real transformation) -- relies on the one validation path inside calculateMetadata instead. Verified live: pnpm smoke covers DslPreview automatically (3 compositions now); rendered a hand-written adhoc.json end to end to a real MP4 and confirmed the pixels; confirmed an invalid doc's DslValidationError (full formatIssues report) surfaces cleanly through Remotion's own error wrapping; spot-checked DslPreview mounting correctly in Studio. Also fixed a schema gap found while wiring the renderer: switch.grow had no component to attach to (StepSwitch is a transparent Fragment) -- removed from schema.ts/types.ts rather than build unused plumbing. pnpm verify green throughout.
- Stage 4 done: authored src/dsl/docs/jwt-auth.json, a full 4-scene translation of the Stage 1 TSX scenes into DSL JSON -- Intro/Breakdown/Summary are direct structural translations; Walkthrough (the hard one) uses two scene-level tracks ("checks" 4 items, "claims" nested via window {track:checks, step:2}) plus a two-case outer switch (card tone/pill text) each containing a duplicated diagram + four-case inner switch (matches the "no loops/templating" design choice -- explicit repetition over cross-referencing). Added src/dsl/docs/manifest.ts (the sole JSON import point) + manifest.test.ts (pins JwtAuthFlowDsl at exactly 1200 frames / offsets [0,180,480,1020], matching storyboard.test.ts's original pin unchanged). Registered it in Root.tsx as JwtAuthFlowDsl alongside the TSX JwtAuthFlow, with a module-scope literal durationInFrames (not calculateMetadata) per the plan's design -- smoke correctness must not depend on whether getCompositions() evaluates calculateMetadata.  A/B result: byte-identical. magick compare -metric AE against the Stage 1 TSX stills at all three canonical frames (anatomy/validation/summary) returned 0 pixel difference -- the DSL port is not just visually close, it is pixel-for-pixel the same render. Saved as docs/assets/jwt-auth-{anatomy,validation,summary}-v3.png (v1=Phase 0 hand-built, v2=Phase 1 component-library rebuild, v3=Phase 2 DSL port).  Demonstrated the exit criterion live: edited narration/tone/a step title in a scratch copy of the JSON (zero TypeScript touched) and re-rendered via pnpm render:dsl to a real MP4. Hit a real investigation along the way -- the tone edit appeared not to take effect across three different render paths (still --props inline, still --props=file, render:dsl), which held up as a genuine-looking bug through several hypotheses (shell quoting, CLI caching, prop-resolution layering) before a targeted diagnostic (onBrowserLog capturing a temporary console.log inside the node renderer, confirmed via a magick crop of just the card's border pixel) proved the pipeline was correct throughout -- I'd been visually sampling the label text's own unchanged tone, not the card border, at too coarse a glance. No code changes resulted; debug logging fully reverted (git diff clean on nodes.tsx).  pnpm verify green (117 tests, 4 compositions smoked). JwtAuthFlow (TSX) and ComponentGallery pixels unchanged.
- Stage 5 done: authored src/dsl/docs/mq-backpressure.json, the first eval-set video with no hand-written TSX precedent -- ~40s, 4 beats (intro: producer/queue/consumer diagram with healthy flows; breakdown: 3 meter cards for producer/consumer rate + queue depth with a threshold marker; walkthrough: a "strategies" track with 4 mitigation cases via a single-level switch; summary: 3 takeaway cards). Validated clean on the first pass -- zero schema errors, zero narration-pacing warnings. Frame pin 1200/[0,210,540,1020] (7+11+16+6s) matched exactly on the first run.  The walkthrough is the first real Terminal use in a narrative video and the first multi-consumer diagram. To avoid the dagre layout jump the plan flagged as a risk when a node is added mid-video, all 4 switch cases share one identical 4-node graph (producer/queue/consumer1/consumer2) -- consumer2 is simply not "active" until the auto-scale case, so nothing ever gets added or removed, only highlighted.  Found and fixed a real component bug in src/components/Terminal/Terminal.tsx: the terminal's root div sets overflow:hidden (for its rounded header corners) but had no flexShrink:0, so when squeezed by taller siblings (the diagram) inside a height-constrained flex card, the browser flex-shrunk it below its own content height and overflow:hidden silently clipped the entire steps area -- command and output were correctly computed and present in the DOM (confirmed via onBrowserLog + a temporary DOM-presence check) but never painted. This is the same class of "renders in still frames, verified visually" bug the Phase 1 hardening carry-overs were about, just in a component nobody had stacked with a taller sibling before. Fixed with one flexShrink:0 (skipped when grow is set, since flex:"1 1 0" already implies shrink there). Also tightened all 4 walkthrough diagrams to width:"half" so the terminal case doesn't spill past its card's border. All debug logging fully reverted -- clean diff is just the flexShrink fix + width:half additions.  Verified all 4 switch cases individually (bounded/blocked, drop/dropped-pulse, terminal/lag-signal, auto-scale/dual-consumer) render correctly with the fix in place. pnpm verify green (118 tests, 5 compositions smoked, 40 frames total). 

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
