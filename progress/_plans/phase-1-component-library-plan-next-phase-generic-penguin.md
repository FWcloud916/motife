# Phase 1 — 解說元件庫 (Explainer Component Library)

## Context

Phase 0 (anchoring) is complete: the hand-built 40s `JwtAuthFlow` baseline video, [docs/primitive-inventory.md](docs/primitive-inventory.md), the license check, and the `pnpm verify` gate all landed via PR #1 (merged, commit `20dc9ba`). Per [motife-plan.md](motife-plan.md) §3, the next phase refactors the video's ad-hoc primitives ([visuals.tsx](src/remotion/compositions/jwt-auth/visuals.tsx)) into a parameterized, design-token-driven component library. **Acceptance:** rebuild the JWT video using only the library with hand-written props, at quality no worse than the manual version (milestone M1).

User decisions: build **all 8 components** (including Terminal/Camera despite 0 uses in the baseline); deliver as **multiple sequential PRs**, each passing `pnpm verify` with the baseline still rendering.

Guiding rules (from motife-plan.md §2 + AGENTS.md hard constraints):
- Props are **semantic and JSON-serializable** (except `children`) — no `style`/`className`/`boxShadow` props; Phase 2's DSL compiler must be able to emit them verbatim.
- Layout comes from a graph layout engine, never caller coordinates.
- All timing inside components is expressed as **fractions of the enclosing Scene's duration** (`Window {from, to}` in 0..1) so Phase 3's TTS-driven durations re-time everything automatically — this fixes Walkthrough.tsx's hardcoded `STEPS start: 35/145/270/410`.
- Remotion packages added only via `npx remotion add <pkg>` at exact 4.0.508, each paired with a new `minimumReleaseAgeExclude` line in `pnpm-workspace.yaml` (the needed packages are NOT currently allowlisted).

## Housekeeping (with PR 1)

- Close out the Phase 0 progress item (`progress/2026-08-12-phase-0-anchor/` — all tasks `[x]` but status still `in-progress`, Outcome empty; PR #1 merged).
- Scaffold a Phase 1 progress item via the progress-tracker skill.

## Directory structure

```text
src/components/            # reserved by docs/project-overview.md §4; only public surface is index.ts
├── index.ts               # barrel — scenes import ONLY from here
├── tokens/                # index.ts (tokens), easing.ts, fonts.ts
├── motion/                # progress.ts, timing.ts — pure, unit-tested
├── icons/                 # registry.tsx (ICON_PATHS), Icon.tsx
├── layout/                # types.ts (GraphSpec/LayoutResult), computeLayout.ts (dagre adapter), edgePath.ts
├── Scene/                 # Scene.tsx, SceneContext.ts ({durationInFrames, fps}), Background.tsx
├── Diagram/               # Diagram.tsx, DiagramNode.tsx, DiagramContext.ts
├── FlowPulse/  CodeBlock/  Terminal/  Camera/  StepReveal/  Callout/
```

Shared vocabulary: `Tone` (neutral|primary|info|success|warning|danger|syntaxA/B/C), `Emphasis` (low|medium|high), `Size` (sm|md|lg), `Window {from, to}` (scene-duration fractions).

## PR breakdown

### PR 1 — `phase-1/tokens-and-foundation`
Tokens, fonts, motion helpers, test runner + the layout-engine-free components: **Scene, Callout, StepReveal, Icon registry**.

- Extend [theme.ts](src/remotion/theme.ts) values into `src/components/tokens/`: keep Phase 0 values verbatim; add `easing` (standard/decelerate/accelerate/emphasize via `Easing.bezier`), `fontFamily` (sans: Inter + Noto Sans TC; mono: JetBrains Mono), `duration.reveal: 22` (the de-facto `enter()` constant), and per-`Tone` color recipes (fg/bgAlpha/borderAlpha — replaces `${color}15` string math). `theme.ts` becomes a deprecated re-export shim so old scenes compile untouched.
- Deterministic fonts: `npx remotion add google-fonts` (+ allowlist entry), `loadFonts()` (Inter, Noto Sans TC chinese-traditional subset weights 400–800, JetBrains Mono) called once in [Root.tsx](src/remotion/Root.tsx). **This is the phase's one intentional baseline visual delta** — re-render the 3 baseline stills, eyeball parity, note in PR description.
- **Scene**: safe-area padding from spacing tokens (kills hardcoded `left:96/top:250`), background variant (grid|plain + glow tone), header slot (eyebrow/title/tone/scale), caption slot; receives `durationInFrames` from composition wiring and provides `SceneContext` — the keystone for all `Window` resolution.
- **StepReveal**: steps with `weight` shares of a `Window`; derived per-step state `pending|active|passed|failed` computed by a pure `useSteps(steps, window)` hook in `motion/timing.ts` so sibling panels (Walkthrough's detail panel) sync to the same boundaries. `outcome: "fail"` renders danger tone + cross icon (the inventory's missing rejected state).
- **Callout**: discriminated union `variant: pill | card | banner`, tone/emphasis/size tokens only — absorbs `Pill`/`Card`/status banners; no style escape hatch.
- **Icons**: `IconName` union = existing 6 + `cross`, `database`, `queue`, `lock`, `document` (for eval videos 2/3).
- Testing: `pnpm add -D vitest`; `"test": "vitest run"` folded into `check` so `pnpm verify` runs it. Unit tests: Window→frames resolution, step-state derivation incl. fail + weight edge cases, every Tone has a recipe.

### PR 2 — `phase-1/diagram-flow-code`
**Diagram (+ layout core), FlowPulse, CodeBlock, Terminal, Camera** + a `ComponentGallery` demo composition.

- Layout engine decision: **`@dagrejs/dagre`** (maintained fork, synchronous — Remotion renders sync per frame; elkjs is Promise-only and would force `delayRender` plumbing inside scenes). Wrapped behind `computeLayout(graph: GraphSpec): LayoutResult` so an ELK swap later is one file. Install: `pnpm add @dagrejs/dagre` (non-Remotion, plain pnpm).
  - `GraphSpec`: `direction`, nodes `{id, icon?, label, detail?, tone?, size?}`, edges `{from, to, label?}` — no coordinates in input. Node dimensions from `Size` token lookup (deterministic; `@remotion/layout-utils` measureText is the upgrade path if CJK labels overflow — open item).
  - `LayoutResult`: coordinates exist only here — node rects + edge `points[]` + SVG path `d`.
- **Diagram**: `useMemo(() => computeLayout(graph))`, renders nodes/edges in its own box with `fit: width|contain` scaling, `activeNodes` emphasis, `reveal` staggering; provides `DiagramContext` for FlowPulse/Camera.
- **FlowPulse**: `FlowSpec {edge, window, tone?, label?, direction?}` resolved against `DiagramContext`; uses `@remotion/paths` (`npx remotion add paths` + allowlist) — `getPointAtLength` for the dot, `evolvePath` for the trailing stroke. Replaces straight-only `FlowLine`; the old in-card A→B line becomes a trivial 2-node Diagram.
- **CodeBlock**: Motion-Canvas-style micro-model, no shiki/prism — `lines: {segments: (string | {text, tone})[], indent?, diff?: added|removed}[]`, `reveal`, `highlights: {lines: [a,b], window}[]` (dims the rest), mono font token. Covers JWT anatomy 3-tone panels + diff animation.
- **Terminal**: `steps: {command, output?, outputTone?, window}[]` — typed-character slice from window progress, block cursor, no randomness (deterministic-randomness lint rule is active).
- **Camera**: `shots: {window, focus: {node}|{target}|"all", zoom: wide|medium|close}[]` — resolves focus rect primarily from Diagram layout data (pure), `<CameraTarget id>` ref-measure as fallback; interpolates scale+translate with `easing.emphasize` as a single wrapper transform.
- `ComponentGallery` composition registered in Root.tsx — makes Terminal/Camera actually smoke-rendered since the JWT video barely uses them. Recommend keeping it permanently as the living showcase (confirm at PR 4).
- Extend [scripts/smoke.mjs](scripts/smoke.mjs): replace hardcoded `COMPOSITION_ID` with `getCompositions()` and sample every composition (keep the single-`inputProps`-object discipline).
- Unit tests: `computeLayout` determinism (two calls deep-equal, ids present, direction respected), `edgePath` valid `d` / no NaN on collinear points.

### PR 3 — `phase-1/jwt-rebuild` (acceptance)
Rebuild the JWT video only from `src/components/*`, as a **parallel composition**.

- New scenes in `scenes-v2/` + `sceneRegistryV2.tsx`; register `JwtAuthFlowV2` alongside the untouched baseline, both sharing [storyboard.ts](src/remotion/compositions/jwt-auth/storyboard.ts) (same durations/narration).
- `npx remotion add transitions` (+ allowlist); v2 wrapper uses `TransitionSeries` with **hard cuts only** (timing-equivalent to sequential Sequences — protects the parity comparison). `transition?: "cut" | "fade"` exists in the storyboard shape; one fade demonstrated in ComponentGallery only. Document that non-cut transitions overlap scenes and require `buildTimeline()` subtraction before any real use.
- Hardest target: [Walkthrough.tsx](src/remotion/compositions/jwt-auth/scenes/Walkthrough.tsx) — its absolute-frame STEPS become `useSteps` + StepReveal windows.
- Quality judgment: render stills of both compositions at the 3 baseline reference frames; commit v2 stills to `docs/assets/` so the "not worse" call is one glance in review.

### PR 4 — `phase-1/swap-and-cleanup`
- Swap v2 into place; **composition id stays `JwtAuthFlow`** (stable public handle for render/smoke/Phase 3). Delete old scenes, `visuals.tsx`, the `theme.ts` shim.
- Optional hardening: ESLint `no-restricted-imports` so `compositions/**` may import only the `src/components` barrel + `remotion`.
- Docs: update primitive-inventory coverage table + project-overview §4 tree (bump "Last updated"); add `docs/component-library.md` written as the de-facto Phase 2 DSL schema draft.
- Close out the Phase 1 progress item after merge.

## Install summary

```text
PR 1: npx remotion add google-fonts   + allowlist '@remotion/google-fonts@4.0.508' ; pnpm add -D vitest
PR 2: pnpm add @dagrejs/dagre ; npx remotion add paths        + allowlist '@remotion/paths@4.0.508'
PR 3: npx remotion add transitions    + allowlist '@remotion/transitions@4.0.508'
```

## Verification

Every PR: `pnpm verify` (typecheck + lint + vitest from PR 1 + multi-composition smoke from PR 2) before declaring done, plus a progress work-log entry. PR 1 additionally: re-rendered baseline stills for the font-change eyeball check. PR 3: side-by-side stills for the acceptance judgment. Final check after PR 4: `pnpm render` produces the MP4 from the component-built composition; from M1 on, this becomes the eval-set regression baseline per motife-plan.md §4.

## Key risks

- dagre layouts vs. hand-tuned Phase 0 positions: mitigate with `fit` scaling + nodesep/ranksep from spacing tokens; the `computeLayout` contract keeps an ELK swap cheap if dagre can't match.
- Noto Sans TC payload slowing bundle/render: load only used weights; measure smoke wall-time before/after PR 1; self-hosted woff2 via `@remotion/fonts` as fallback.
- Prop-shape drift from Phase 2 DSL needs: JSON-serializable rule + reviewing `docs/component-library.md` against motife-plan.md §2 決策2 at PR 4.
